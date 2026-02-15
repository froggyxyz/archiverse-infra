import { io } from 'socket.io-client'
import { createTusUpload } from '~/lib/archive/tus-upload'
import { ARCHIVE_STAGES } from '~/types/archive'
import type { ArchiveProgressPayload } from '~/types/archive'

type UploadQueueItem = {
  id: string
  file: File
  stage: string
  progress: number
  error?: string
}

let archiveSocket: ReturnType<typeof io> | null = null

export const useArchive = () => {
  const config = useRuntimeConfig()
  const { accessToken } = useAuthTokens()
  const api = useApiEndpoints()

  const storage = ref<{ usedBytes: number; limitBytes: number } | null>(null)
  const archiveList = ref<Awaited<ReturnType<typeof api.archive.list>> | null>(null)
  const progressMap = ref<Record<string, { stage: string; progress: number }>>({})
  const uploadQueue = ref<UploadQueueItem[]>([])
  const isConnecting = ref(false)

  const baseUrl = (config.public.apiBaseUrl as string).replace(/\/$/, '')
  const tusEndpoint = `${baseUrl}/tus/archive`

  const fetchStorage = async () => {
    storage.value = await api.archive.getStorage()
    return storage.value
  }

  const checkQuota = async (sizeBytes: number) => {
    const result = await api.archive.checkQuota(sizeBytes)
    return result
  }

  const fetchArchive = async (page = 1, limit = 20) => {
    archiveList.value = await api.archive.list(page, limit)
    return archiveList.value
  }

  const connectSocket = () => {
    if (import.meta.server) return
    const token = accessToken.value
    if (!token) return
    if (archiveSocket?.connected) return
    if (archiveSocket) {
      archiveSocket.connect()
      return
    }
    isConnecting.value = true
    archiveSocket = io(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      auth: { token },
      query: { token },
    })
    archiveSocket.on('archive:progress', (data: ArchiveProgressPayload) => {
      progressMap.value = {
        ...progressMap.value,
        [data.mediaId]: { stage: data.stage, progress: data.progress },
      }
      if (data.stage !== ARCHIVE_STAGES.UPLOADING) {
        fetchArchive()
      }
      if (data.stage === ARCHIVE_STAGES.COMPLETED || data.stage === ARCHIVE_STAGES.FAILED) {
        fetchStorage()
        const next = { ...progressMap.value }
        delete next[data.mediaId]
        progressMap.value = next
      }
    })
    archiveSocket.on('connect', () => {
      isConnecting.value = false
    })
    archiveSocket.on('connect_error', () => {
      isConnecting.value = false
    })
  }

  const getItemProgress = (mediaId: string) => {
    return progressMap.value[mediaId] ?? null
  }

  const uploadFiles = async (files: File[]) => {
    const token = accessToken.value
    if (!token) throw new Error('Необходима авторизация')

    const totalSize = files.reduce((s, f) => s + f.size, 0)
    const { allowed } = await checkQuota(totalSize)
    if (!allowed) throw new Error('Недостаточно места в хранилище')

    const items: UploadQueueItem[] = files.map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file: f,
      stage: ARCHIVE_STAGES.UPLOADING,
      progress: 0,
    }))
    uploadQueue.value = [...uploadQueue.value, ...items]

    connectSocket()

    const uploadSingle = async (item: UploadQueueItem) => {
      try {
        await new Promise<void>((resolve, reject) => {
          const upload = createTusUpload({
            file: item.file,
            uploadUrl: tusEndpoint,
            accessToken: token,
            onProgress: (bytesUploaded, bytesTotal) => {
              const i = uploadQueue.value.findIndex((u) => u.id === item.id)
              if (i >= 0) {
                uploadQueue.value[i] = {
                  ...uploadQueue.value[i],
                  stage: ARCHIVE_STAGES.UPLOADING,
                  progress: bytesTotal > 0 ? bytesUploaded / bytesTotal : 0,
                }
              }
            },
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          })
          upload.start()
        })
        uploadQueue.value = uploadQueue.value.filter((u) => u.id !== item.id)
        await fetchStorage()
        await fetchArchive()
      } catch (err) {
        const i = uploadQueue.value.findIndex((u) => u.id === item.id)
        if (i >= 0) {
          uploadQueue.value[i] = {
            ...uploadQueue.value[i],
            stage: ARCHIVE_STAGES.FAILED,
            progress: 0,
            error: (err as Error).message,
          }
        }
      }
    }

    await Promise.all(items.map(uploadSingle))
  }

  const removeFromQueue = (id: string) => {
    uploadQueue.value = uploadQueue.value.filter((u) => u.id !== id)
  }

  const deleteMedia = async (id: string) => {
    await api.archive.delete(id)
    await fetchStorage()
    await fetchArchive()
  }

  const getMediaViewUrl = async (mediaId: string): Promise<string | null> => {
    const res = await api.archive.getViewUrl(mediaId)
    return res?.url ?? null
  }

  return {
    storage,
    archiveList,
    progressMap,
    uploadQueue,
    fetchStorage,
    fetchArchive,
    checkQuota,
    uploadFiles,
    removeFromQueue,
    deleteMedia,
    getMediaViewUrl,
    getItemProgress,
    connectSocket,
  }
}

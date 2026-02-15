import * as tus from 'tus-js-client'

export type TusUploadOptions = {
  file: File
  uploadUrl: string
  accessToken: string
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export const createTusUpload = (options: TusUploadOptions) => {
  const { file, uploadUrl, accessToken, onProgress, onSuccess, onError } = options

  // Чанки по 5 МБ — несколько PATCH вместо одного долгого запроса на весь файл
  const chunkSize = 5 * 1024 * 1024

  const upload = new tus.Upload(file, {
    endpoint: uploadUrl,
    chunkSize,
    retryDelays: [0, 1000, 3000, 5000, 10000],
    metadata: {
      filename: file.name,
      filetype: file.type,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    onProgress: (bytesUploaded, bytesTotal) => {
      onProgress?.(bytesUploaded, bytesTotal)
    },
    onSuccess: () => {
      onSuccess?.()
    },
    onError: (err) => {
      onError?.(err)
    },
  })

  return upload
}

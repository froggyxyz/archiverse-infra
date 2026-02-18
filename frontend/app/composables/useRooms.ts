import type { Ref } from 'vue'
import { io } from 'socket.io-client'
import type { ChatWindowMessage } from '~/types/chat'
import type { RoomInfo, RoomPlaylistItemInfo, RoomChatMessageInfo } from '~/types/room'

let roomsSocket: ReturnType<typeof io> | null = null

const toChatWindowMessage = (
  m: RoomChatMessageInfo,
  currentUserId: string | undefined
): ChatWindowMessage => ({
  id: m.id,
  text: m.text,
  isOwn: m.senderId === currentUserId,
  senderName: m.senderId !== currentUserId ? m.senderName : undefined,
  createdAt: m.createdAt,
})

export const useRooms = (roomIdRef: Ref<string | undefined>) => {
  const config = useRuntimeConfig()
  const { accessToken } = useAuthTokens()
  const { user } = useAuthTokens()
  const api = useApiEndpoints()

  const room = ref<RoomInfo | null>(null)
  const playlist = ref<RoomPlaylistItemInfo[]>([])
  const messages = ref<ChatWindowMessage[]>([])
  const participants = ref<Awaited<ReturnType<typeof api.rooms.getParticipants>>>([])
  const isLoadingRoom = ref(false)
  const isLoadingPlaylist = ref(false)
  const isLoadingMessages = ref(false)
  const isLoadingParticipants = ref(false)

  const baseUrl = (config.public.apiBaseUrl as string).replace(/\/$/, '')

  const fetchRoom = async () => {
    const id = roomIdRef.value
    if (!id) return null

    isLoadingRoom.value = true
    try {
      room.value = await api.rooms.getRoom(id)
      return room.value
    } finally {
      isLoadingRoom.value = false
    }
  }

  const fetchPlaylist = async () => {
    const id = roomIdRef.value
    if (!id) return []

    isLoadingPlaylist.value = true
    try {
      playlist.value = await api.rooms.getPlaylist(id)
      return playlist.value
    } finally {
      isLoadingPlaylist.value = false
    }
  }

  const fetchMessages = async (cursor?: string) => {
    const id = roomIdRef.value
    if (!id) return { messages: [], nextCursor: null }

    isLoadingMessages.value = true
    try {
      const res = await api.rooms.getMessages(id, { cursor, limit: 50 })
      const converted = res.messages.map((m) =>
        toChatWindowMessage(m, user.value?.id)
      )
      if (cursor && messages.value.length > 0) {
        messages.value = [...messages.value, ...converted]
      } else {
        messages.value = converted
      }
      return { messages: converted, nextCursor: res.nextCursor }
    } finally {
      isLoadingMessages.value = false
    }
  }

  const connectSocket = () => {
    if (import.meta.server) return
    const token = accessToken.value
    if (!token) return

    if (!roomsSocket) {
      roomsSocket = io(baseUrl, {
        path: '/socket.io',
        transports: ['websocket'],
        reconnection: true,
        auth: { token },
        query: { token },
      })
    }

    if (!roomsSocket.connected) {
      roomsSocket.connect()
    }
  }

  const joinRoom = () => {
    const id = roomIdRef.value
    if (!id || !roomsSocket) return

    const doJoin = () => {
      roomsSocket!.emit('room:join', { roomId: id })
    }

    if (roomsSocket.connected) {
      doJoin()
    } else {
      roomsSocket.once('connect', doJoin)
    }
  }

  const leaveRoom = () => {
    const id = roomIdRef.value
    if (!id || !roomsSocket?.connected) return
    roomsSocket.emit('room:leave', { roomId: id })
  }

  const sendChatMessage = (text: string) => {
    const id = roomIdRef.value
    if (!id || !roomsSocket?.connected) return
    roomsSocket.emit('chat:send', { roomId: id, text })
  }

  type PlayerStatePayload = {
    playing?: boolean
    currentTime?: number
    mediaId?: string
  }

  const emitPlayerState = (state: PlayerStatePayload) => {
    const id = roomIdRef.value
    if (!id || !roomsSocket?.connected) return
    roomsSocket.emit('player:state', { roomId: id, ...state })
  }

  const setupPlayerStateListener = (callback: (state: PlayerStatePayload) => void) => {
    if (!roomsSocket) return () => {}
    const handler = (payload: PlayerStatePayload & { userId?: string }) => {
      if (payload.userId === user.value?.id) return
      callback(payload)
    }
    roomsSocket.on('player:state', handler)
    return () => { roomsSocket?.off('player:state', handler) }
  }

  const fetchParticipants = async () => {
    const id = roomIdRef.value
    if (!id) return []
    isLoadingParticipants.value = true
    try {
      participants.value = await api.rooms.getParticipants(id)
      return participants.value
    } finally {
      isLoadingParticipants.value = false
    }
  }

  const addToPlaylist = async (mediaIds: string[]) => {
    const id = roomIdRef.value
    if (!id) return []
    playlist.value = await api.rooms.addToPlaylist(id, mediaIds)
    return playlist.value
  }

  const removeFromPlaylist = async (itemId: string) => {
    const id = roomIdRef.value
    if (!id) return
    await api.rooms.removeFromPlaylist(id, itemId)
    await fetchPlaylist()
  }

  const reorderPlaylist = async (itemIds: string[]) => {
    const id = roomIdRef.value
    if (!id) return []
    playlist.value = await api.rooms.reorderPlaylist(id, itemIds)
    return playlist.value
  }

  const getMediaViewUrl = async (mediaId: string): Promise<string | null> => {
    const id = roomIdRef.value
    if (!id) return null
    const res = await api.rooms.getMediaViewUrl(id, mediaId)
    return res?.url ?? null
  }

  const setupSocketListeners = () => {
    if (!roomsSocket) return

    const onChatMessage = (msg: RoomChatMessageInfo) => {
      // Сокет в одной комнате — приходящие chat:message всегда для текущей комнаты
      const converted = toChatWindowMessage(msg, user.value?.id)
      if (messages.value.some((m) => m.id === msg.id)) return
      messages.value = [...messages.value, converted]
    }

    const onPlaylistUpdated = () => {
      if (roomIdRef.value) void fetchPlaylist()
    }

    const onParticipantList = (list: Awaited<ReturnType<typeof api.rooms.getParticipants>>) => {
      participants.value = list
    }

    roomsSocket.off('chat:message')
    roomsSocket.off('playlist:updated')
    roomsSocket.off('participant:list')
    roomsSocket.on('chat:message', (msg: RoomChatMessageInfo) => {
      onChatMessage(msg)
    })
    roomsSocket.on('playlist:updated', onPlaylistUpdated)
    roomsSocket.on('participant:list', onParticipantList)

    return () => {
      roomsSocket?.off('chat:message')
      roomsSocket?.off('playlist:updated')
      roomsSocket?.off('participant:list')
    }
  }

  const createRoom = async () => {
    const created = await api.rooms.create()
    return created
  }

  return {
    room,
    playlist,
    messages,
    participants,
    isLoadingRoom,
    isLoadingPlaylist,
    isLoadingMessages,
    isLoadingParticipants,
    fetchRoom,
    fetchPlaylist,
    fetchMessages,
    fetchParticipants,
    connectSocket,
    joinRoom,
    leaveRoom,
    sendChatMessage,
    emitPlayerState,
    setupPlayerStateListener,
    setupSocketListeners,
    createRoom,
    addToPlaylist,
    removeFromPlaylist,
    reorderPlaylist,
    getMediaViewUrl,
  }
}

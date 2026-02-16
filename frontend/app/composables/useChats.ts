import type { Ref } from 'vue'
import { io } from 'socket.io-client'
import type {
  ChatListItem,
  ChatWindowMessage,
  MessageWithAttachments,
} from '~/types/chat'

let chatsSocket: ReturnType<typeof io> | null = null

export const useChats = (activeChatIdRef?: Ref<string | null>) => {
  const config = useRuntimeConfig()
  const { accessToken } = useAuthTokens()
  const { user } = useAuthTokens()
  const api = useApiEndpoints()

  const chatList = ref<ChatListItem[] | null>(null)
  const messagesMap = ref<Record<string, ChatWindowMessage[]>>({})
  const isLoadingChats = ref(false)
  const isLoadingMessages = ref(false)

  const baseUrl = (config.public.apiBaseUrl as string).replace(/\/$/, '')

  const toChatWindowMessage = (
    m: MessageWithAttachments,
    currentUserId: string,
    otherUsername: string
  ): ChatWindowMessage => ({
    id: m.id,
    text: m.text ?? '',
    isOwn: m.senderId === currentUserId,
    senderName: m.senderId !== currentUserId ? otherUsername : undefined,
    createdAt: m.createdAt,
  })

  const fetchChats = async () => {
    isLoadingChats.value = true
    try {
      chatList.value = await api.chats.list()
      return chatList.value
    } finally {
      isLoadingChats.value = false
    }
  }

  const fetchMessages = async (
    chatId: string,
    otherUsername: string,
    cursor?: string
  ) => {
    const uid = user.value?.id
    if (!uid) return { messages: [], nextCursor: null }

    isLoadingMessages.value = true
    try {
      const res = await api.chats.getMessages(chatId, cursor, 50)
      const converted = res.messages.map((m) =>
        toChatWindowMessage(m, uid, otherUsername)
      )
      const existing = messagesMap.value[chatId] ?? []
      const merged =
        cursor && existing.length > 0
          ? [...existing, ...converted]
          : converted
      messagesMap.value = { ...messagesMap.value, [chatId]: merged }
      return { messages: merged, nextCursor: res.nextCursor }
    } finally {
      isLoadingMessages.value = false
    }
  }

  const connectSocket = () => {
    if (import.meta.server) return
    const token = accessToken.value
    if (!token) return
    if (chatsSocket?.connected) return
    if (chatsSocket) {
      chatsSocket.connect()
      return
    }

    chatsSocket = io(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      auth: { token },
      query: { token },
    })

    chatsSocket.on('message:new', (message: MessageWithAttachments) => {
      const chatId = message.chatId
      const chat = chatList.value?.find((c) => c.id === chatId)
      const otherUsername = chat?.otherUser.username ?? ''
      const uid = user.value?.id
      if (!uid) return

      const converted = toChatWindowMessage(message, uid, otherUsername)
      const existing = messagesMap.value[chatId] ?? []
      if (existing.some((m) => m.id === message.id)) return
      messagesMap.value = {
        ...messagesMap.value,
        [chatId]: [...existing, converted],
      }

      if (chat) {
        const lastMessage = {
          text: message.text,
          attachmentPreview: message.attachments[0]
            ? { type: message.attachments[0].type, url: message.attachments[0].thumbnailUrl ?? message.attachments[0].url }
            : null,
        }
        const updatedChat: ChatListItem = {
          ...chat,
          lastMessageAt: message.createdAt,
          lastMessage,
        }
        chatList.value = [
          updatedChat,
          ...(chatList.value ?? []).filter((c) => c.id !== chatId),
        ]
      }
    })

    chatsSocket.on('chat:unread', async (payload: { chatId: string; unreadCount: number }) => {
      if (
        activeChatIdRef?.value === payload.chatId &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        await markRead(payload.chatId)
        return
      }
      chatList.value =
        chatList.value?.map((c) =>
          c.id === payload.chatId ? { ...c, unreadCount: payload.unreadCount } : c
        ) ?? null
    })
  }

  const sendMessage = (chatId: string, text: string) => {
    if (!chatsSocket?.connected) return
    chatsSocket.emit('message:send', { chatId, text })
  }

  const markRead = async (chatId: string) => {
    await api.chats.markRead(chatId)
    chatList.value =
      chatList.value?.map((c) =>
        c.id === chatId ? { ...c, unreadCount: 0 } : c
      ) ?? null
  }

  const getMessages = (chatId: string) => messagesMap.value[chatId] ?? []

  onMounted(() => {
    if (accessToken.value) connectSocket()
  })

  watch(accessToken, (token) => {
    if (token) connectSocket()
  })

  return {
    chatList,
    messagesMap,
    isLoadingChats,
    isLoadingMessages,
    fetchChats,
    fetchMessages,
    sendMessage,
    markRead,
    getMessages,
  }
}

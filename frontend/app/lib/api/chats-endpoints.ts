import type { ApiClient } from '~/types/api'
import type { ChatListItem, ChatMessagesResult } from '~/types/chat'

export const createChatsEndpoints = (api: ApiClient) => ({
  list: () => api.get<ChatListItem[]>('/chats'),

  getMessages: (chatId: string, cursor?: string, limit = 50) => {
    const params: Record<string, string | number> = { limit }
    if (cursor) params.cursor = cursor
    return api.get<ChatMessagesResult>(`/chats/${chatId}`, { params })
  },

  markRead: (chatId: string) =>
    api.post<{ ok: boolean }>(`/chats/${chatId}/read`),

  getOrCreateDirect: (userId: string) =>
    api.post<{ chatId: string }>('/chats/direct', { userId }),
})

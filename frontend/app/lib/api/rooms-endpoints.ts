import type { ApiClient } from '~/types/api'
import type {
  RoomInfo,
  RoomParticipantInfo,
  RoomPlaylistItemInfo,
  RoomChatMessageInfo,
} from '~/types/room'

export const createRoomsEndpoints = (api: ApiClient) => ({
  create: () => api.post<RoomInfo>('/rooms'),

  joinByInviteCode: (inviteCode: string) =>
    api.post<{ roomId: string }>(`/rooms/join/${encodeURIComponent(inviteCode)}`),

  getRoom: (roomId: string) => api.get<RoomInfo>(`/rooms/${roomId}`),

  getParticipants: (roomId: string) =>
    api.get<RoomParticipantInfo[]>(`/rooms/${roomId}/participants`),

  getPlaylist: (roomId: string) =>
    api.get<RoomPlaylistItemInfo[]>(`/rooms/${roomId}/playlist`),

  addToPlaylist: (roomId: string, mediaIds: string[]) =>
    api.post<RoomPlaylistItemInfo[]>(`/rooms/${roomId}/playlist`, {
      mediaIds,
    }),

  reorderPlaylist: (roomId: string, itemIds: string[]) =>
    api.patch<RoomPlaylistItemInfo[]>(`/rooms/${roomId}/playlist/reorder`, {
      itemIds,
    }),

  removeFromPlaylist: (roomId: string, itemId: string) =>
    api.delete<void>(`/rooms/${roomId}/playlist/${itemId}`),

  getMediaViewUrl: (roomId: string, mediaId: string) =>
    api.get<{ url: string | null }>(`/rooms/${roomId}/media/${mediaId}/view-url`),

  getMessages: (
    roomId: string,
    params?: { cursor?: string; limit?: number }
  ) => {
    const searchParams: Record<string, string | number> = {
      limit: params?.limit ?? 50,
    }
    if (params?.cursor) searchParams.cursor = params.cursor
    return api.get<{
      messages: RoomChatMessageInfo[]
      nextCursor: string | null
    }>(`/rooms/${roomId}/messages`, { params: searchParams })
  },
})

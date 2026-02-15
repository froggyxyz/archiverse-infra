import type { ApiClient } from '~/types/api'
import type {
  MediaListResult,
  MediaListItem,
  StorageInfo,
  CheckQuotaResult,
} from '~/types/archive'

export const createArchiveEndpoints = (api: ApiClient) => ({
  list: (page = 1, limit = 20) =>
    api.get<MediaListResult>('/archive', { params: { page, limit } }),

  getOne: (id: string) => api.get<MediaListItem>(`/archive/${id}`),

  getViewUrl: (id: string) =>
    api.get<{ url: string | null }>(`/archive/${id}/view-url`),

  delete: (id: string) => api.delete<void>(`/archive/${id}`),

  getStorage: () => api.get<StorageInfo>('/users/me/storage'),

  checkQuota: (size: number) =>
    api.post<CheckQuotaResult>('/users/me/storage/check', { size }),
})

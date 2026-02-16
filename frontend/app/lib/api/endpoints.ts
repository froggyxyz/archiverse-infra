import type { ApiClient } from '~/types/api'
import { createAuthEndpoints } from './auth-endpoints'
import { createUsersEndpoints } from './users-endpoints'
import { createArchiveEndpoints } from './archive-endpoints'
import { createChatsEndpoints } from './chats-endpoints'

export const createHealthApi = (api: ApiClient) => ({
  check: () => api.get<string>('/'),
})

export const createApiEndpoints = (api: ApiClient) => ({
  health: createHealthApi(api),
  auth: createAuthEndpoints(api),
  users: createUsersEndpoints(api),
  archive: createArchiveEndpoints(api),
  chats: createChatsEndpoints(api),
})

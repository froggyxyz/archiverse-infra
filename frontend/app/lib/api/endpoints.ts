import type { ApiClient } from '~/types/api'
import { createAuthEndpoints } from './auth-endpoints'

export const createHealthApi = (api: ApiClient) => ({
  check: () => api.get<string>('/'),
})

export const createApiEndpoints = (api: ApiClient) => ({
  health: createHealthApi(api),
  auth: createAuthEndpoints(api),
})

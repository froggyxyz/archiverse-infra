import type { ApiClient } from '~/types/api'

export const createHealthApi = (api: ApiClient) => ({
  check: () => api.get<string>('/'),
})

export const createApiEndpoints = (api: ApiClient) => ({
  health: createHealthApi(api),
})

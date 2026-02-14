import { createApiClient } from '~/lib/api/client'
import { createApiEndpoints } from '~/lib/api/endpoints'
import type { ApiClient } from '~/types/api'

let apiClient: ApiClient | null = null

export const useApi = (): ApiClient => {
  const config = useRuntimeConfig()

  if (!apiClient) {
    apiClient = createApiClient(config.public.apiBaseUrl)
  }

  return apiClient
}

export const useApiEndpoints = () => {
  const api = useApi()
  return createApiEndpoints(api)
}

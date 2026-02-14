import { createApiEndpoints } from '~/lib/api/endpoints'
import type { ApiClient } from '~/types/api'

export const useApi = (): ApiClient => {
  const { $api } = useNuxtApp()
  return $api as ApiClient
}

export const useApiEndpoints = () => {
  const api = useApi()
  return createApiEndpoints(api)
}

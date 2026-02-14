import { createApiClient } from '~/lib/api/client'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const { accessToken, setTokens, setUser, clear, tokens } = useAuthTokens()

  const baseUrl = config.public.apiBaseUrl as string

  const performRefresh = async (): Promise<boolean> => {
    const refreshToken = tokens.value?.refreshToken
    if (!refreshToken) {
      clear()
      return false
    }

    try {
      const result = await $fetch<{ accessToken: string; refreshToken: string }>(
        `${baseUrl}/auth/refresh`,
        {
          method: 'POST',
          body: { refreshToken },
          headers: { 'Content-Type': 'application/json' },
        }
      )
      setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken })
      return true
    } catch {
      clear()
      if (import.meta.client) {
        navigateTo({ path: '/login', query: { session_expired: '1' } })
      }
      return false
    }
  }

  const api = createApiClient(baseUrl, {
    getAccessToken: () => accessToken.value,
    onUnauthorized: performRefresh,
  })

  return {
    provide: {
      api,
    },
  }
})

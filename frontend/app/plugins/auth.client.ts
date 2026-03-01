import { AUTH_KEYS } from '~/lib/auth/constants'

export default defineNuxtPlugin(() => {
  const { restoreFromStorage } = useAuthTokens()
  restoreFromStorage()

  if (import.meta.client) {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === AUTH_KEYS.TOKENS || e.key === AUTH_KEYS.USER) {
        restoreFromStorage()
      }
    })
  }
})

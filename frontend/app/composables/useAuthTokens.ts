import type { AuthTokens, AuthUser } from '~/types/auth'
import { getStoredTokens, setStoredTokens, getStoredUser, setStoredUser, clearAuthStorage } from '~/lib/auth/storage'
import { isTokenExpired } from '~/lib/auth/jwt'

const TOKENS_KEY = 'auth-tokens'
const USER_KEY = 'auth-user'

export const useAuthTokens = () => {
  const tokens = useState<AuthTokens | null>(TOKENS_KEY, () => null)
  const user = useState<AuthUser | null>(USER_KEY, () => null)

  const setTokens = (value: AuthTokens | null) => {
    tokens.value = value
    setStoredTokens(value)
  }

  const setUser = (value: AuthUser | null) => {
    user.value = value
    setStoredUser(value)
  }

  const hasValidAccessToken = computed(() => {
    const t = tokens.value?.accessToken
    return Boolean(t && !isTokenExpired(t))
  })

  const hasRefreshToken = computed(() => Boolean(tokens.value?.refreshToken))

  const accessToken = computed(() => tokens.value?.accessToken ?? null)

  const clear = () => {
    tokens.value = null
    user.value = null
    clearAuthStorage()
  }

  const restoreFromStorage = () => {
    if (import.meta.server) return
    const storedTokens = getStoredTokens()
    const storedUser = getStoredUser()
    if (storedTokens) {
      tokens.value = storedTokens
    }
    if (storedUser) {
      user.value = storedUser
    }
  }

  return {
    tokens,
    user,
    setTokens,
    setUser,
    hasValidAccessToken,
    hasRefreshToken,
    accessToken,
    clear,
    restoreFromStorage,
  }
}

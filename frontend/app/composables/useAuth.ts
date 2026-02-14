import type { AuthResponse, LoginCredentials } from '~/types/auth'
import { AUTH_ROUTES } from '~/lib/auth/constants'
import { createAuthEndpoints } from '~/lib/api/auth-endpoints'
import { useAuthTokens } from './useAuthTokens'
import { useApi } from './useApi'

export const useAuth = () => {
  const router = useRouter()
  const { setTokens, setUser, user, clear, hasValidAccessToken, hasRefreshToken } =
    useAuthTokens()
  const api = useApi()
  const authApi = createAuthEndpoints(api)

  const isAuthenticated = computed(
    () => hasValidAccessToken.value || (hasRefreshToken.value && user.value !== null)
  )

  const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await authApi.login(credentials)
    setTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    })
    setUser(response.user)
    return response
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore logout API errors
    } finally {
      clear()
      router.push(AUTH_ROUTES.LOGIN)
    }
  }

  const refresh = async () => {
    const response = await authApi.refresh(useAuthTokens().tokens.value!.refreshToken)
    setTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    })
    return response
  }

  const fetchUser = async () => {
    const { user: fetchedUser } = await authApi.me()
    setUser(fetchedUser)
    return fetchedUser
  }

  return {
    user,
    isAuthenticated,
    login,
    logout,
    refresh,
    fetchUser,
  }
}

import type { ApiClient } from '~/types/api'
import type { AuthResponse, LoginCredentials, RefreshResponse } from '~/types/auth'

export const createAuthEndpoints = (api: ApiClient) => ({
  login: (credentials: LoginCredentials) =>
    api.post<AuthResponse>('/auth/login', credentials),

  refresh: (refreshToken: string) =>
    api.post<RefreshResponse>('/auth/refresh', { refreshToken }),

  logout: () => api.post<void>('/auth/logout'),

  me: () => api.get<{ user: AuthResponse['user'] }>('/auth/me'),
})

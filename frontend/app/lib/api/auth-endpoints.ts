import type { ApiClient } from '~/types/api'
import type { AuthResponse, LoginCredentials, RefreshResponse, RegisterCredentials } from '~/types/auth'

export const createAuthEndpoints = (api: ApiClient) => ({
  register: (credentials: RegisterCredentials) =>
    api.post<AuthResponse>('/auth/register', credentials),

  login: (credentials: LoginCredentials) =>
    api.post<AuthResponse>('/auth/login', credentials),

  refresh: (refreshToken: string) =>
    api.post<RefreshResponse>('/auth/refresh', { refreshToken }),

  logout: () => api.post<void>('/auth/logout'),

  me: () => api.get<{ user: AuthResponse['user'] }>('/auth/me'),
})

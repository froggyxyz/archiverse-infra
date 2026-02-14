export type AuthUser = {
  id: string
  username: string
  [key: string]: unknown
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
}

export type LoginCredentials = {
  username: string
  password: string
}

export type RegisterCredentials = {
  username: string
  password: string
}

export type AuthResponse = {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

export type RefreshResponse = {
  accessToken: string
  refreshToken: string
}

export type AuthRouteMeta = {
  auth?: boolean | 'optional'
}

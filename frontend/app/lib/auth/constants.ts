const AUTH_STORAGE_KEY = 'archiverse_auth'

export const AUTH_KEYS = {
  TOKENS: `${AUTH_STORAGE_KEY}_tokens`,
  USER: `${AUTH_STORAGE_KEY}_user`,
} as const

export const AUTH_ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  HOME: '/',
} as const

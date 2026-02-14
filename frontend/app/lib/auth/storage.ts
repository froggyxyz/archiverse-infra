import type { AuthTokens, AuthUser } from '~/types/auth'
import { AUTH_KEYS } from './constants'

const getStorage = () => (import.meta.client ? sessionStorage : null)

export const getStoredTokens = (): AuthTokens | null => {
  const storage = getStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(AUTH_KEYS.TOKENS)
    return raw ? (JSON.parse(raw) as AuthTokens) : null
  } catch {
    return null
  }
}

export const setStoredTokens = (tokens: AuthTokens | null): void => {
  const storage = getStorage()
  if (!storage) return
  if (tokens) {
    storage.setItem(AUTH_KEYS.TOKENS, JSON.stringify(tokens))
  } else {
    storage.removeItem(AUTH_KEYS.TOKENS)
  }
}

export const getStoredUser = (): AuthUser | null => {
  const storage = getStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(AUTH_KEYS.USER)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export const setStoredUser = (user: AuthUser | null): void => {
  const storage = getStorage()
  if (!storage) return
  if (user) {
    storage.setItem(AUTH_KEYS.USER, JSON.stringify(user))
  } else {
    storage.removeItem(AUTH_KEYS.USER)
  }
}

export const clearAuthStorage = (): void => {
  const storage = getStorage()
  if (!storage) return
  storage.removeItem(AUTH_KEYS.TOKENS)
  storage.removeItem(AUTH_KEYS.USER)
}

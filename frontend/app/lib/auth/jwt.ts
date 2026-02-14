type JwtPayload = {
  exp?: number
  [key: string]: unknown
}

const decodeJwt = (token: string): JwtPayload | null => {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = atob(parts[1]?.replace(/-/g, '+').replace(/_/g, '/') ?? '')
    return JSON.parse(payload) as JwtPayload
  } catch {
    return null
  }
}

export const isTokenExpired = (token: string, bufferSeconds = 60): boolean => {
  const payload = decodeJwt(token)
  if (!payload?.exp) return true
  return Date.now() >= (payload.exp - bufferSeconds) * 1000
}

export const getTokenExpiry = (token: string): number | null => {
  const payload = decodeJwt(token)
  return payload?.exp ?? null
}

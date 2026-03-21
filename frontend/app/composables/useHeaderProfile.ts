import type { PublicProfile } from '~/types/user'

const HEADER_PROFILE_KEY = 'app-header-profile-cache'

type HeaderProfileCache = {
  username: string
  avatarUrl: string | null
}

/**
 * Кэш аватара/профиля для шапки: один запрос на сессию для данного username,
 * без повторной подгрузки при каждом переходе и перемонтировании layout.
 */
export const useHeaderProfile = () => {
  const cached = useState<HeaderProfileCache | null>(HEADER_PROFILE_KEY, () => null)

  const invalidateHeaderProfile = () => {
    cached.value = null
  }

  /** После uploadAvatar — обновить URL без лишнего GET */
  const updateHeaderProfileCache = (profile: Pick<PublicProfile, 'username' | 'avatarUrl'>) => {
    const { user } = useAuthTokens()
    if (!user.value || user.value.username !== profile.username) return
    cached.value = { username: profile.username, avatarUrl: profile.avatarUrl }
  }

  const ensureHeaderProfile = async () => {
    const { user } = useAuthTokens()
    const u = user.value
    if (!u || import.meta.server) {
      cached.value = null
      return
    }
    if (cached.value?.username === u.username) return
    try {
      const profile = await useApiEndpoints().users.getProfile(u.username)
      cached.value = { username: profile.username, avatarUrl: profile.avatarUrl }
    } catch {
      if (cached.value?.username !== u.username) cached.value = null
    }
  }

  return {
    headerProfile: cached,
    ensureHeaderProfile,
    invalidateHeaderProfile,
    updateHeaderProfileCache,
  }
}

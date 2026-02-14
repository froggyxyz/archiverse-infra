import type { ApiClient } from '~/types/api'
import type { PublicProfile } from '~/types/user'

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_AVATAR_SIZE = 2 * 1024 * 1024

export const createUsersEndpoints = (api: ApiClient) => ({
  getProfile: (idOrUsername: string) =>
    api.get<PublicProfile>(`/users/${encodeURIComponent(idOrUsername)}`),

  getMe: () => api.get<PublicProfile>('/users/me'),

  uploadAvatar: (file: File): Promise<PublicProfile> => {
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      throw new Error('Допустимые форматы: JPEG, PNG, WebP')
    }
    if (file.size > MAX_AVATAR_SIZE) {
      throw new Error('Максимальный размер файла: 2 МБ')
    }
    const formData = new FormData()
    formData.append('avatar', file)
    return api.postFormData<PublicProfile>('/users/me/avatar', formData)
  },
})

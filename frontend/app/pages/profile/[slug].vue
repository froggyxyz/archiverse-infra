<script setup lang="ts">
definePageMeta({
  auth: true,
})

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const { user } = useAuth()
const { addSuccess, addError } = useAlerts()

const { data: profile, pending, error, refresh } = await useAsyncData(
  `profile-${slug.value}`,
  () => useApiEndpoints().users.getProfile(slug.value),
  {
    watch: [slug],
    server: false,
  }
)

const isOwnProfile = computed(
  () => user.value && profile.value && (user.value.id === profile.value.id || user.value.username === profile.value.username)
)

const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)

const triggerFileSelect = () => {
  if (isOwnProfile.value) fileInput.value?.click()
}

const handleAvatarChange = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isUploading.value = true
  target.value = ''
  try {
    await useApiEndpoints().users.uploadAvatar(file)
    addSuccess('Аватар обновлён')
    await refresh()
  } catch (e) {
    addError((e as Error)?.message ?? 'Не удалось загрузить аватар')
  } finally {
    isUploading.value = false
  }
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}
</script>

<template>
  <div class="profile-page">
    <div v-if="pending" class="profile-page__loading">
      Загрузка...
    </div>
    <div v-else-if="error" class="profile-page__error">
      <p>{{ (error as { statusCode?: number })?.statusCode === 404 ? 'Пользователь не найден' : 'Не удалось загрузить профиль' }}</p>
    </div>
    <div v-else-if="profile" class="profile-page__content">
      <div
        class="profile-page__avatar-wrapper"
        :class="{
          'profile-page__avatar-wrapper--editable': isOwnProfile,
          'profile-page__avatar-wrapper--uploading': isUploading,
        }"
        @click="triggerFileSelect"
      >
        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="profile-page__file-input"
          @change="handleAvatarChange"
        >
        <div v-if="isOwnProfile" class="profile-page__avatar-overlay">
          {{ isUploading ? 'Загрузка...' : 'Сменить фото' }}
        </div>
        <div class="profile-page__avatar">
          <img
            v-if="profile.avatarUrl"
            :src="profile.avatarUrl"
            :alt="profile.username"
            class="profile-page__avatar-img"
          >
          <div v-else class="profile-page__avatar-placeholder">
            {{ profile.username.charAt(0).toUpperCase() }}
          </div>
        </div>
      </div>
      <h1 class="profile-page__username">
        {{ profile.username }}
      </h1>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.profile-page__loading,
.profile-page__error {
  color: var(--text-secondary);
}

.profile-page__content {
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.profile-page__avatar-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 1.5rem;
  cursor: default;
}

.profile-page__avatar-wrapper--editable {
  cursor: pointer;
}

.profile-page__avatar-wrapper--editable:hover .profile-page__avatar-overlay {
  opacity: 1;
}

.profile-page__file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.profile-page__avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.6);
  font-size: 0.75rem;
  color: white;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 1;
}

.profile-page__avatar-wrapper--editable:hover .profile-page__avatar-overlay,
.profile-page__avatar-wrapper--uploading .profile-page__avatar-overlay {
  opacity: 1;
}

.profile-page__avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--bg-secondary);
}

.profile-page__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-page__avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  font-weight: 600;
  color: var(--text-secondary);
  pointer-events: none;

  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.profile-page__username {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.profile-page__meta {
  color: var(--text-secondary);
  font-size: 0.875rem;
}
</style>

<script setup lang="ts">
import { formatSize } from '~/utils/format-size'
import { ARCHIVE_STAGE_LABELS } from '~/types/archive'

definePageMeta({
  auth: true,
})

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const { user } = useAuth()
const { addSuccess, addError } = useAlerts()

const {
  storage,
  archiveList,
  uploadQueue,
  fetchStorage,
  fetchArchive,
  checkQuota,
  uploadFiles,
  removeFromQueue,
  deleteMedia,
  getMediaViewUrl,
  getItemProgress,
  connectSocket,
} = useArchive()

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
const selectedFiles = ref<File[]>([])
const fileInputError = ref('')
const uploadError = ref('')
const isArchiveUploading = ref(false)

const storageUsedPercent = computed(() => {
  if (!storage.value || storage.value.limitBytes === 0) return 0
  return Math.min(100, (storage.value.usedBytes / storage.value.limitBytes) * 100)
})

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

const startArchiveUpload = async () => {
  if (selectedFiles.value.length === 0) {
    fileInputError.value = 'Выберите файлы'
    return
  }
  uploadError.value = ''
  fileInputError.value = ''
  const totalSize = selectedFiles.value.reduce((s, f) => s + f.size, 0)
  try {
    const { allowed } = await checkQuota(totalSize)
    if (!allowed) {
      uploadError.value = 'Недостаточно места в хранилище'
      return
    }
    isArchiveUploading.value = true
    const files = [...selectedFiles.value]
    selectedFiles.value = []
    await uploadFiles(files)
  } catch (err) {
    uploadError.value = (err as Error).message
  } finally {
    isArchiveUploading.value = false
  }
}

const getStageLabel = (stage: string) =>
  ARCHIVE_STAGE_LABELS[stage as keyof typeof ARCHIVE_STAGE_LABELS] ?? stage

const openingUrl = ref(false)
const openMedia = async (item: { id: string; type: string }) => {
  if (item.type === 'VIDEO') {
    await navigateTo({ path: '/watch', query: { id: item.id } })
    return
  }
  openingUrl.value = true
  try {
    const url = await getMediaViewUrl(item.id)
    if (url) window.open(url, '_blank', 'noopener')
  } finally {
    openingUrl.value = false
  }
}

watch(isOwnProfile, async (own) => {
  if (own) {
    connectSocket()
    await Promise.all([fetchStorage(), fetchArchive()])
  }
}, { immediate: true })
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

      <template v-if="isOwnProfile">
        <section v-if="storage" class="profile-archive-storage">
          <div class="profile-archive-storage__header">
            <span>Хранилище</span>
            <span class="profile-archive-storage__usage">
              {{ formatSize(storage.usedBytes) }} / {{ formatSize(storage.limitBytes) }}
            </span>
          </div>
          <div class="profile-archive-storage__bar">
            <div
              class="profile-archive-storage__fill"
              :style="{ width: `${storageUsedPercent}%` }"
            />
          </div>
        </section>

        <section class="profile-archive-upload">
          <h2 class="profile-archive__title">Загрузка</h2>
          <UiFileInput
            v-model="selectedFiles"
            label="Медиафайлы"
            hint="Перетащите сюда или нажмите (аудио, видео, изображения)"
            :error="fileInputError"
            @error="fileInputError = $event"
          />
          <UiButton
            :disabled="selectedFiles.length === 0 || isArchiveUploading"
            @click="startArchiveUpload"
          >
            {{ isArchiveUploading ? 'Загрузка…' : 'Загрузить' }}
          </UiButton>
          <p v-if="uploadError" class="profile-archive-upload__error">
            {{ uploadError }}
          </p>
        </section>

        <section v-if="uploadQueue.length > 0" class="profile-archive-queue">
          <h2 class="profile-archive__title">Загрузка в процессе</h2>
          <ul class="profile-archive-queue__list">
            <li
              v-for="item in uploadQueue"
              :key="item.id"
              class="profile-archive-queue__item"
            >
              <div class="profile-archive-queue__info">
                <span class="profile-archive-queue__name">{{ item.file.name }}</span>
                <span class="profile-archive-queue__stage">{{ getStageLabel(item.stage) }}</span>
                <span v-if="item.error" class="profile-archive-queue__error">{{ item.error }}</span>
              </div>
              <div v-if="!item.error" class="profile-archive-queue__progress">
                <div
                  class="profile-archive-queue__progress-fill"
                  :style="{ width: `${item.progress * 100}%` }"
                />
              </div>
              <button
                type="button"
                class="profile-archive-queue__remove"
                aria-label="Убрать из очереди"
                @click="removeFromQueue(item.id)"
              >
                <Icon name="mdi:close" />
              </button>
            </li>
          </ul>
        </section>

        <section class="profile-archive-grid">
          <h2 class="profile-archive__title">Мои файлы</h2>
          <div v-if="!archiveList" class="profile-archive-grid__loading">
            Загрузка…
          </div>
          <p v-else-if="archiveList.items.length === 0" class="profile-archive-grid__empty">
            Архив пуст
          </p>
          <ul v-else class="profile-archive-grid__list">
            <li
              v-for="item in archiveList.items"
              :key="item.id"
              class="profile-archive-grid__cell"
            >
              <div class="profile-archive-grid__preview">
                <img
                  v-if="item.type === 'IMAGE' && item.viewUrl"
                  :src="item.viewUrl"
                  :alt="item.filename"
                  class="profile-archive-grid__thumb"
                  loading="lazy"
                >
                <img
                  v-else-if="item.type === 'VIDEO' && item.thumbnailUrl"
                  :src="item.thumbnailUrl"
                  :alt="item.filename"
                  class="profile-archive-grid__thumb"
                  loading="lazy"
                >
                <div v-else class="profile-archive-grid__icon-wrap">
                  <Icon
                    v-if="item.type === 'VIDEO'"
                    name="mdi:movie-open-outline"
                    class="profile-archive-grid__icon"
                  />
                  <Icon
                    v-else-if="item.type === 'AUDIO'"
                    name="mdi:music-note-outline"
                    class="profile-archive-grid__icon"
                  />
                  <Icon
                    v-else
                    name="mdi:image-outline"
                    class="profile-archive-grid__icon"
                  />
                </div>
              </div>
              <div class="profile-archive-grid__overlay">
                <span class="profile-archive-grid__name">{{ item.filename }}</span>
                <div
                  v-if="getItemProgress(item.id) && item.status !== 'READY' && item.status !== 'FAILED'"
                  class="profile-archive-grid__progress"
                >
                  {{ getStageLabel(getItemProgress(item.id)!.stage) }}: {{ Math.round(getItemProgress(item.id)!.progress * 100) }}%
                </div>
                <div v-else class="profile-archive-grid__actions">
                  <UiButton
                    v-if="item.status === 'READY' || item.status === 'PROCESSING'"
                    size="sm"
                    :disabled="openingUrl"
                    @click.stop="openMedia(item)"
                  >
                    Открыть
                  </UiButton>
                  <UiButton
                    size="sm"
                    @click.stop="deleteMedia(item.id)"
                  >
                    Удалить
                  </UiButton>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </template>
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
  max-width: 900px;
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
}

.profile-page__username {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.profile-archive__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  text-align: left;
}

.profile-archive-storage {
  padding: 16px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  margin-bottom: 1.5rem;
}

.profile-archive-storage__header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.profile-archive-storage__usage {
  font-weight: 500;
  color: var(--text-color);
}

.profile-archive-storage__bar {
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--color-primary);
}

.profile-archive-storage__fill {
  height: 100%;
  background-color: var(--accent-color);
  transition: width 0.2s;
}

.profile-archive-upload {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 1.5rem;
  text-align: left;
}

.profile-archive-upload__error {
  font-size: 14px;
  color: #ef4444;
}

.profile-archive-queue__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 1.5rem;
}

.profile-archive-queue__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
}

.profile-archive-queue__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-archive-queue__name {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-archive-queue__stage {
  font-size: 12px;
  color: var(--text-secondary);
}

.profile-archive-queue__error {
  font-size: 12px;
  color: #ef4444;
}

.profile-archive-queue__progress {
  flex: 0 0 120px;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background-color: var(--color-primary);
}

.profile-archive-queue__progress-fill {
  height: 100%;
  background-color: var(--accent-color);
  transition: width 0.2s;
}

.profile-archive-queue__remove {
  flex-shrink: 0;
  padding: 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
}

.profile-archive-queue__remove:hover {
  color: #ef4444;
}

.profile-archive-grid__loading,
.profile-archive-grid__empty {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
}

.profile-archive-grid__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.profile-archive-grid__cell {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--bg-secondary);
}

.profile-archive-grid__preview {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.profile-archive-grid__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-archive-grid__icon-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary);
}

.profile-archive-grid__icon {
  font-size: 48px;
  color: var(--text-secondary);
}

.profile-archive-grid__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 8px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent 60%);
}

.profile-archive-grid__name {
  font-size: 12px;
  color: white;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-archive-grid__progress {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 4px;
}

.profile-archive-grid__actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
  opacity: 0;
  transition: opacity 0.2s;
}

.profile-archive-grid__cell:hover .profile-archive-grid__actions {
  opacity: 1;
}

.profile-archive-grid__actions :deep(.av-btn) {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  font-size: 12px;
}
</style>

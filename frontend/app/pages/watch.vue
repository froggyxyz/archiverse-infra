<script setup lang="ts">
definePageMeta({
  auth: true,
})

const route = useRoute()
const router = useRouter()
const { getMediaViewUrl } = useArchive()

const mediaId = computed(() => (route.query.id as string) ?? '')
const videoRef = ref<HTMLVideoElement | null>(null)
const error = ref<string | null>(null)
const loading = ref(true)

let hlsInstance: InstanceType<typeof import('hls.js').default> | null = null

const initPlayer = async (url: string) => {
  const video = videoRef.value
  if (!video) return

  const isHls = url.includes('.m3u8')
  if (isHls) {
    const Hls = (await import('hls.js')).default
    if (Hls.isSupported()) {
      hlsInstance = new Hls()
      hlsInstance.loadSource(url)
      hlsInstance.attachMedia(video)
      hlsInstance.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) error.value = 'Ошибка загрузки видео'
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
    } else {
      error.value = 'HLS не поддерживается в этом браузере'
    }
  } else {
    video.src = url
  }
}

onMounted(async () => {
  const id = mediaId.value
  if (!id) {
    error.value = 'Не указан id медиа'
    loading.value = false
    return
  }
  try {
    const url = await getMediaViewUrl(id)
    if (!url) {
      error.value = 'Не удалось получить ссылку на просмотр'
      return
    }
    await nextTick()
    await initPlayer(url)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }
})

const { user } = useAuth()
const goBack = () => router.push(user.value ? `/profile/${user.value.username}` : '/dashboard')
</script>

<template>
  <div class="watch-page">
    <header class="watch-page__header">
      <button type="button" class="watch-page__back" aria-label="Назад" @click="goBack">
        <Icon name="mdi:arrow-left" />
      </button>
      <h1 class="watch-page__title">Просмотр</h1>
    </header>

    <div v-if="loading" class="watch-page__loading">Загрузка…</div>
    <p v-else-if="error" class="watch-page__error">{{ error }}</p>
    <div v-else class="watch-page__player-wrap">
      <video
        ref="videoRef"
        class="watch-page__video"
        controls
        playsinline
      />
    </div>
  </div>
</template>

<style scoped>
.watch-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px;
}

.watch-page__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.watch-page__back {
  display: flex;
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-color);
  cursor: pointer;
}

.watch-page__back:hover {
  background: var(--color-primary);
}

.watch-page__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.watch-page__loading,
.watch-page__error {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
}

.watch-page__error {
  color: #ef4444;
}

.watch-page__player-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.watch-page__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>

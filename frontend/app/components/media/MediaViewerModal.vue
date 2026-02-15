<script setup lang="ts">
import type { MediaListItem } from '~/types/archive'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    items: MediaListItem[]
    initialIndex?: number
    getViewUrl: (id: string) => Promise<string | null>
  }>(),
  { initialIndex: 0 }
)

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
const containerRef = ref<HTMLElement | null>(null)

const currentIndex = ref(props.initialIndex)
const viewUrls = ref<Record<string, string>>({})
const loadingUrl = ref(false)
const swipeOffset = ref(0)
const isSwiping = ref(false)
const touchStartX = ref(0)

const currentItem = computed(() => props.items[currentIndex.value])

const canGoPrev = computed(() => currentIndex.value > 0)
const canGoNext = computed(() => currentIndex.value < props.items.length - 1)

const goPrev = () => {
  if (canGoPrev.value) {
    currentIndex.value--
    swipeOffset.value = 0
  }
}

const goNext = () => {
  if (canGoNext.value) {
    currentIndex.value++
    swipeOffset.value = 0
  }
}

const close = () => emit('update:modelValue', false)

const ensureViewUrl = async (item: MediaListItem) => {
  if (viewUrls.value[item.id]) return viewUrls.value[item.id]
  loadingUrl.value = true
  try {
    const url = await props.getViewUrl(item.id)
    if (url) viewUrls.value[item.id] = url
    return url
  } finally {
    loadingUrl.value = false
  }
}

const currentViewUrl = ref<string | null>(null)

watch(
  [currentItem, () => props.modelValue],
  async ([item]) => {
    if (!item || !props.modelValue) {
      currentViewUrl.value = null
      return
    }
    const url = await ensureViewUrl(item as MediaListItem)
    currentViewUrl.value = url ?? null
  },
  { immediate: true }
)

watch(
  () => props.initialIndex,
  (idx) => {
    currentIndex.value = idx ?? 0
  }
)

const viewerEl = ref<HTMLElement | null>(null)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      document.body.style.overflow = 'hidden'
      nextTick(() => viewerEl.value?.focus())
    } else {
      document.body.style.overflow = ''
    }
  }
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})

const SWIPE_THRESHOLD = 80

const onTouchStart = (e: TouchEvent) => {
  isSwiping.value = true
  touchStartX.value = e.touches[0]?.clientX ?? 0
}

const onTouchMove = (e: TouchEvent) => {
  if (!isSwiping.value) return
  const dx = e.touches[0]?.clientX ?? 0 - touchStartX.value
  if (canGoPrev.value && dx > 0) swipeOffset.value = Math.min(dx, 120)
  else if (canGoNext.value && dx < 0) swipeOffset.value = Math.max(dx, -120)
  else swipeOffset.value = dx * 0.3
}

const onTouchEnd = () => {
  if (!isSwiping.value) return
  isSwiping.value = false
  if (swipeOffset.value > SWIPE_THRESHOLD) goPrev()
  else if (swipeOffset.value < -SWIPE_THRESHOLD) goNext()
  else swipeOffset.value = 0
}

const onMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return
  isSwiping.value = true
  touchStartX.value = e.clientX
  const onMouseMove = (e2: MouseEvent) => {
    const dx = e2.clientX - touchStartX.value
    if (canGoPrev.value && dx > 0) swipeOffset.value = Math.min(dx, 120)
    else if (canGoNext.value && dx < 0) swipeOffset.value = Math.max(dx, -120)
    else swipeOffset.value = dx * 0.3
  }
  const onMouseUp = () => {
    isSwiping.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    if (swipeOffset.value > SWIPE_THRESHOLD) goPrev()
    else if (swipeOffset.value < -SWIPE_THRESHOLD) goNext()
    else swipeOffset.value = 0
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') close()
  if (e.key === 'ArrowLeft') goPrev()
  if (e.key === 'ArrowRight') goNext()
}

</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        ref="viewerEl"
        v-show="modelValue"
        class="media-viewer"
        tabindex="-1"
        @keydown="onKeydown"
      >
        <div
          class="media-viewer__backdrop"
          aria-hidden="true"
          @click="close"
        />
        <div
          ref="containerRef"
          class="media-viewer__container"
          @touchstart.passive="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend="onTouchEnd"
          @mousedown="onMouseDown"
        >
          <button
            v-if="canGoPrev"
            type="button"
            class="media-viewer__nav media-viewer__nav--prev"
            aria-label="Предыдущее"
            @click.stop="goPrev"
          >
            <Icon name="mdi:chevron-left" class="media-viewer__arrow" />
          </button>

          <div
            class="media-viewer__center"
            :style="{ transform: `translateX(${swipeOffset}px)` }"
            @click.self="close"
          >
            <div v-if="loadingUrl && !currentViewUrl" class="media-viewer__loading">
              Загрузка…
            </div>
            <template v-else-if="currentItem && currentViewUrl">
              <img
                v-if="currentItem.type === 'IMAGE'"
                :src="currentViewUrl"
                :alt="currentItem.filename"
                class="media-viewer__media media-viewer__media--img"
                draggable="false"
              >
              <div
                v-else-if="currentItem.type === 'VIDEO'"
                class="media-viewer__media media-viewer__media--video"
              >
                <WidgetVideoPlayer
                  :video="currentViewUrl"
                  :name="currentItem.filename"
                />
              </div>
              <div
                v-else-if="currentItem.type === 'AUDIO'"
                class="media-viewer__media media-viewer__media--audio"
              >
                <Icon name="mdi:music-note-outline" class="media-viewer__audio-icon" />
                <audio
                  :src="currentViewUrl"
                  controls
                  class="media-viewer__audio"
                />
                <span class="media-viewer__audio-name">{{ currentItem.filename }}</span>
              </div>
            </template>
          </div>

          <button
            v-if="canGoNext"
            type="button"
            class="media-viewer__nav media-viewer__nav--next"
            aria-label="Следующее"
            @click.stop="goNext"
          >
            <Icon name="mdi:chevron-right" class="media-viewer__arrow" />
          </button>
        </div>

        <button
          type="button"
          class="media-viewer__close"
          aria-label="Закрыть"
          @click="close"
        >
          <Icon name="mdi:close" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.media-viewer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.media-viewer__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
}

.media-viewer__container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  max-width: 100vw;
  max-height: 100vh;
}

.media-viewer__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  cursor: pointer;
  z-index: 5;
  transition: background 0.2s;
}

.media-viewer__nav:hover {
  background: rgba(255, 255, 255, 0.25);
}

.media-viewer__nav--prev {
  left: 24px;
}

.media-viewer__nav--next {
  right: 24px;
}

.media-viewer__arrow {
  font-size: 32px;
}

.media-viewer__center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  transition: transform 0.2s ease-out;
}

.media-viewer__loading {
  color: rgba(255, 255, 255, 0.7);
}

.media-viewer__media {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
}

.media-viewer__media--img {
  max-width: 90vw;
  max-height: 90vh;
}

.media-viewer__media--video {
  width: 90vw;
  max-width: 960px;
  aspect-ratio: 16 / 9;
}

.media-viewer__media--audio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;
}

.media-viewer__audio-icon {
  font-size: 64px;
  color: rgba(255, 255, 255, 0.6);
}

.media-viewer__audio {
  width: 100%;
  max-width: 400px;
}

.media-viewer__audio-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400px;
}

.media-viewer__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  z-index: 10;
  transition: background 0.2s;
}

.media-viewer__close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

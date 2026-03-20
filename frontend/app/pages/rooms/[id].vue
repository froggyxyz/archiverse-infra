<script setup lang="ts">
import type { RoomPlaylistItem } from '~/types/room'

definePageMeta({
  auth: true,
  layout: 'room',
})

const route = useRoute()
const roomId = computed(() => route.params.id as string)

const isChatOpen = ref(false)
const isPlaylistOpen = ref(false)
const isAddModalOpen = ref(false)

const openChat = () => {
  isPlaylistOpen.value = false
  isChatOpen.value = !isChatOpen.value
}

const openPlaylist = () => {
  isChatOpen.value = false
  isPlaylistOpen.value = !isPlaylistOpen.value
}

const closeChat = () => { isChatOpen.value = false }
const closePlaylist = () => { isPlaylistOpen.value = false }

const roomFullscreenRef = ref<HTMLElement | null>(null)
const isRoomFullscreen = ref(false)

const leaveRoomAndGo = () => {
  leaveRoom()
  const username = user.value?.username
  navigateTo(username ? `/profile/${encodeURIComponent(username)}` : '/')
}

const onLeaveClick = () => {
  if (document.fullscreenElement && roomFullscreenRef.value && document.fullscreenElement === roomFullscreenRef.value) {
    document.exitFullscreen()
  } else {
    leaveRoomAndGo()
  }
}

const { user } = useAuthTokens()

const {
  room,
  playlist,
  messages: chatMessages,
  participants,
  isLoadingRoom,
  isLoadingPlaylist,
  isLoadingMessages,
  isLoadingParticipants,
  fetchRoom,
  fetchPlaylist,
  fetchMessages,
  fetchParticipants,
  connectSocket,
  joinRoom,
  leaveRoom,
  sendChatMessage,
  emitPlayerState,
  setupPlayerStateListener,
  setupRoomPlayerStateListener,
  setupSocketListeners,
  addToPlaylist,
  removeFromPlaylist,
  reorderPlaylist,
  getMediaViewUrl,
} = useRooms(roomId)

const videoPlayerRef = ref<{ applyRemoteState: (s: { playing?: boolean; currentTime?: number }) => void } | null>(null)
const currentMediaId = ref<string | null>(null)

const lastRemotePlayerState = ref<{ currentTime?: number; playing?: boolean }>({})

const playlistItems = computed<RoomPlaylistItem[]>(() =>
  [...playlist.value]
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      id: item.id,
      mediaId: item.mediaId,
      title: item.filename,
      duration: '—',
      thumbnailUrl: item.thumbnailUrl,
    }))
)

const inviteLink = computed(() => {
  if (import.meta.server || !room.value?.inviteCode) return ''
  return `${window.location.origin}/rooms/join/${room.value.inviteCode}`
})

const isCopyingInvite = ref(false)

const { addSuccess } = useAlerts()

const copyInviteLink = async () => {
  if (!inviteLink.value) return
  try {
    await navigator.clipboard.writeText(inviteLink.value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = inviteLink.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  isCopyingInvite.value = true
  addSuccess('Ссылка скопирована')
  setTimeout(() => { isCopyingInvite.value = false }, 2000)
}

const onChatSend = (text: string) => {
  sendChatMessage(text)
}

const videoUrl = ref('')
const { addError } = useAlerts()

const isVideoPlaying = ref(false)

const onPlayerStateChange = (state: { playing?: boolean; currentTime?: number }) => {
  if (state.playing !== undefined) isVideoPlaying.value = state.playing
  emitPlayerState({
    ...state,
    mediaId: currentMediaId.value ?? undefined,
  })
}

const ROOM_UI_IDLE_DELAY_MS = 5000
let roomUiIdleTimer: ReturnType<typeof setTimeout> | null = null
const roomUiHiddenByIdle = ref(false)

const clearRoomUiIdleTimer = () => {
  if (roomUiIdleTimer != null) {
    clearTimeout(roomUiIdleTimer)
    roomUiIdleTimer = null
  }
}

const startRoomUiIdleTimer = () => {
  clearRoomUiIdleTimer()
  if (!isVideoPlaying.value) return
  roomUiIdleTimer = setTimeout(() => {
    if (!isVideoPlaying.value) return
    roomUiHiddenByIdle.value = true
    roomUiIdleTimer = null
  }, ROOM_UI_IDLE_DELAY_MS)
}

const onRoomMouseEnter = () => {
  roomUiHiddenByIdle.value = false
  startRoomUiIdleTimer()
}

const onRoomMouseMove = () => {
  if (roomUiHiddenByIdle.value) roomUiHiddenByIdle.value = false
  startRoomUiIdleTimer()
}

const onRoomMouseLeave = () => {
  clearRoomUiIdleTimer()
  roomUiHiddenByIdle.value = true
}

const loadVideoByMediaId = async (
  mediaId: string,
  options?: { skipEmit?: boolean }
) => {
  const url = await getMediaViewUrl(mediaId)
  if (url) {
    currentMediaId.value = mediaId
    videoUrl.value = url
    if (!options?.skipEmit) emitPlayerState({ mediaId })
  }
}

const playFirstFromPlaylist = () => {
  const first = playlistItems.value[0]
  if (first) void loadVideoByMediaId(first.mediaId)
}

const clearPlayer = (options?: { skipEmit?: boolean }) => {
  currentMediaId.value = null
  videoUrl.value = ''
  lastRemotePlayerState.value = {}
  if (!options?.skipEmit) emitPlayerState({ mediaId: null as string | null })
}

const onSyncRequest = () => {
  const state = lastRemotePlayerState.value
  videoPlayerRef.value?.applyRemoteState({
    currentTime: state.currentTime,
    playing: true,
  })
}

const onPlaylistSelect = async (item: RoomPlaylistItem) => {
  await loadVideoByMediaId(item.mediaId)
}

const onPlaylistAdd = async (mediaIds: string[]) => {
  try {
    await addToPlaylist(mediaIds)
    addSuccess(`Добавлено: ${mediaIds.length}`)
  } catch (e) {
    addError((e as Error)?.message ?? 'Не удалось добавить')
  }
}

const onPlaylistRemove = (itemId: string) => {
  const removedItem = playlist.value.find((p) => p.id === itemId)
  const wasCurrent = removedItem && currentMediaId.value === removedItem.mediaId
  removeFromPlaylist(itemId)
    .then(() => {
      if (wasCurrent && playlist.value.length > 0) playFirstFromPlaylist()
    })
    .catch((e) => addError((e as Error)?.message ?? 'Не удалось удалить'))
}

const onPlaylistReorder = (itemIds: string[]) => {
  reorderPlaylist(itemIds).catch((e) => addError((e as Error)?.message ?? 'Не удалось изменить порядок'))
}

const excludeMediaIds = computed(() => playlist.value.map((p) => p.mediaId))

const otherParticipants = computed(() => {
  const uid = user.value?.id
  if (!uid) return participants.value
  return participants.value.filter((p) => p.userId !== uid)
})

const messagesInitialized = ref(false)
const showChatPulse = ref(false)

watch(chatMessages, (newVal, oldVal) => {
  if (!messagesInitialized.value) {
    if (newVal.length > 0) messagesInitialized.value = true
    return
  }
  if (newVal.length > (oldVal?.length ?? 0)) {
    const last = newVal[newVal.length - 1]
    if (last && !last.isOwn) {
      showChatPulse.value = true
      setTimeout(() => { showChatPulse.value = false }, 2500)
    }
  }
}, { deep: true })

watch(
  () => playlist.value,
  () => {
    if (playlist.value.length === 0) {
      if (currentMediaId.value) clearPlayer()
      return
    }
    if (!currentMediaId.value) {
      playFirstFromPlaylist()
      return
    }
    if (!playlist.value.some((p) => p.mediaId === currentMediaId.value)) {
      playFirstFromPlaylist()
    }
  },
  { deep: true }
)

const handleRoomFullscreenChange = () => {
  isRoomFullscreen.value = !!(document.fullscreenElement && roomFullscreenRef.value && document.fullscreenElement === roomFullscreenRef.value)
}

onMounted(async () => {
  document.addEventListener('fullscreenchange', handleRoomFullscreenChange)
  const r = await fetchRoom()
  if (!r) return
  await Promise.all([fetchPlaylist(), fetchMessages(), fetchParticipants()])
  connectSocket()
  nextTick(() => {
    joinRoom()
    setupSocketListeners()
    roomPlayerStateTeardown = setupRoomPlayerStateListener((state) => {
      if (!state.mediaId) {
        clearPlayer({ skipEmit: true })
      } else {
        lastRemotePlayerState.value = { currentTime: state.currentTime, playing: state.isPlaying }
        loadVideoByMediaId(state.mediaId, { skipEmit: true }).then(() => {
          videoPlayerRef.value?.applyRemoteState({
            currentTime: state.currentTime,
            playing: state.isPlaying,
          })
        })
      }
    })
    playerStateTeardown = setupPlayerStateListener((state) => {
      if (state.mediaId == null) {
        clearPlayer({ skipEmit: true })
      } else if (state.mediaId !== currentMediaId.value) {
        loadVideoByMediaId(state.mediaId)
      }
      if (state.mediaId != null) {
        lastRemotePlayerState.value = { currentTime: state.currentTime, playing: state.playing }
        videoPlayerRef.value?.applyRemoteState({
          playing: state.playing,
          currentTime: state.currentTime,
        })
      }
    })
  })
})

let playerStateTeardown: (() => void) | undefined
let roomPlayerStateTeardown: (() => void) | undefined

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleRoomFullscreenChange)
  clearRoomUiIdleTimer()
  roomPlayerStateTeardown?.()
  playerStateTeardown?.()
  leaveRoom()
})
</script>

<template>
  <div v-if="isLoadingRoom && !room" class="room-page room-page--loading">
    <p>Загрузка комнаты…</p>
  </div>
  <div v-else-if="!room" class="room-page room-page--error">
    <p>Комната не найдена</p>
  </div>
    <div
      v-else
      ref="roomFullscreenRef"
      class="room-page"
      :class="{ 'room-page--ui-hidden': roomUiHiddenByIdle }"
      @mouseenter="onRoomMouseEnter"
      @mousemove="onRoomMouseMove"
      @mouseleave="onRoomMouseLeave"
    >
    <div class="room-page__player">
      <div v-if="!videoUrl" class="room-page__player-placeholder">
        <span class="room-page__player-placeholder-text">Выберите медиа</span>
      </div>
      <WidgetVideoPlayer
        v-else
        ref="videoPlayerRef"
        :video="videoUrl"
        name=""
        :overlay-hidden-by-parent="roomUiHiddenByIdle"
        :fullscreen-root="roomFullscreenRef"
        @state-change="onPlayerStateChange"
        @sync-request="onSyncRequest"
      >
        <template #above-controls>
          <div class="room-page__avatars-in-player">
            <template v-for="p in otherParticipants" :key="p.id">
              <img
                v-if="p.avatarUrl"
                :src="p.avatarUrl"
                :alt="p.username"
                class="room-page__avatar-in-player"
                :title="p.username"
              >
              <div
                v-else
                class="room-page__avatar-in-player room-page__avatar-in-player--placeholder"
                :title="p.username"
              >
                <Icon name="mdi:account" />
              </div>
            </template>
          </div>
        </template>
      </WidgetVideoPlayer>
    </div>

    <button
      type="button"
      class="room-page__leave-btn"
      :aria-label="isRoomFullscreen ? 'Выйти из полноэкранного режима' : 'Выйти из комнаты'"
      @click="onLeaveClick"
    >
      <Icon name="mdi:close" class="room-page__leave-icon" />
    </button>

    <Transition name="chat-pulse">
      <div v-if="showChatPulse" class="room-page__chat-pulse" aria-hidden="true">
        <span class="room-page__chat-pulse-wave room-page__chat-pulse-wave--1" />
        <span class="room-page__chat-pulse-wave room-page__chat-pulse-wave--2" />
        <span class="room-page__chat-pulse-wave room-page__chat-pulse-wave--3" />
      </div>
    </Transition>

    <div class="room-page__actions">
      <button
        type="button"
        class="room-page__action-btn"
        :class="{ 'room-page__action-btn--active': isChatOpen }"
        aria-label="Чат"
        @click="openChat"
      >
        <Icon name="mdi:message-outline" class="room-page__action-icon" />
      </button>
      <button
        type="button"
        class="room-page__action-btn"
        :class="{ 'room-page__action-btn--active': isPlaylistOpen }"
        aria-label="Плейлист"
        @click="openPlaylist"
      >
        <Icon name="mdi:playlist-music" class="room-page__action-icon" />
      </button>
      <button
        type="button"
        class="room-page__action-btn"
        :aria-label="isCopyingInvite ? 'Скопировано' : 'Копировать ссылку'"
        @click="copyInviteLink"
      >
        <Icon
          :name="isCopyingInvite ? 'mdi:check' : 'mdi:link-variant'"
          class="room-page__action-icon"
        />
      </button>
      <div class="room-page__avatars">
        <template v-for="p in otherParticipants" :key="p.id">
          <img
            v-if="p.avatarUrl"
            :src="p.avatarUrl"
            :alt="p.username"
            class="room-page__avatar"
            :title="p.username"
          >
          <div
            v-else
            class="room-page__avatar room-page__avatar--placeholder"
            :title="p.username"
          >
            <Icon name="mdi:account" />
          </div>
        </template>
      </div>
    </div>

    <Transition name="room-panel">
      <div v-show="isChatOpen" class="room-page__panel room-page__panel--chat">
        <div class="room-page__panel-header">
          <span class="room-page__panel-title">Чат</span>
          <button type="button" class="room-page__panel-close" aria-label="Закрыть" @click="closeChat">
            <Icon name="mdi:close" />
          </button>
        </div>
        <div class="room-page__panel-content">
          <WidgetChatWindow
            user-name="Чат"
            :messages="chatMessages"
            :disabled="isLoadingMessages"
            :hide-avatar="true"
            input-placeholder="Сообщение в комнату…"
            @send="onChatSend"
          />
        </div>
      </div>
    </Transition>

    <Transition name="room-panel">
      <div v-show="isPlaylistOpen" class="room-page__panel room-page__panel--playlist">
        <div class="room-page__panel-header">
          <span class="room-page__panel-title">Плейлист</span>
          <button type="button" class="room-page__panel-close" aria-label="Закрыть" @click="closePlaylist">
            <Icon name="mdi:close" />
          </button>
        </div>
        <div class="room-page__panel-content">
          <div v-if="isLoadingPlaylist && !playlist.length" class="room-page__loading">
            Загрузка…
          </div>
          <RoomPlaylist
            v-else
            :items="playlistItems"
            :current-media-id="currentMediaId"
            @add="isAddModalOpen = true"
            @remove="onPlaylistRemove"
            @reorder="onPlaylistReorder"
            @select="onPlaylistSelect"
          />
        </div>
      </div>
    </Transition>

    <RoomAddFromArchiveModal
      v-model="isAddModalOpen"
      :exclude-media-ids="excludeMediaIds"
      @add="onPlaylistAdd"
    />
  </div>
</template>

<style scoped>
.room-page {
  position: relative;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.room-page__leave-btn,
.room-page__actions,
.room-page__chat-pulse {
  transition: opacity 0.3s ease;
}

.room-page--ui-hidden .room-page__leave-btn,
.room-page--ui-hidden .room-page__actions,
.room-page--ui-hidden .room-page__chat-pulse {
  opacity: 0;
  pointer-events: none;
}

.room-page__player {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: stretch;
}

@media (max-width: 768px) {
  .room-page {
    flex-direction: column;
  }

  .room-page__player {
    position: relative;
    flex: 0 0 auto;
    width: 100%;
    aspect-ratio: 16 / 9;
    min-height: 0;
  }

  .room-page__player :deep(.av-video-player) {
    object-fit: contain;
  }

  .room-page__player :deep(.av-video-player__video) {
    object-fit: cover;
    object-position: top;
  }

  .room-page__actions .room-page__avatars {
    display: none;
  }
}

.room-page__avatars-in-player {
  display: none;
  flex-direction: row-reverse;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 8px 0;
  flex-wrap: wrap;
}

.room-page__avatar-in-player {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.room-page__avatar-in-player--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 16px;
}

@media (max-width: 768px) {
  .room-page__avatars-in-player {
    display: flex;
  }
}

.room-page__player :deep(.av-video-player) {
  width: 100%;
  height: 100%;
}

.room-page__player-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0a;
}

.room-page__player-placeholder-text {
  font-size: 18px;
  color: var(--text-secondary);
}

.room-page__leave-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 2;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.2s, transform 0.15s;
}

.room-page__leave-icon {
  font-size: 46px;
  font-weight: 700;
}

/* Четверть круга в углу: волновая анимация при новом сообщении в чат */
.room-page__chat-pulse {
  position: absolute;
  top: 0;
  right: 0;
  width: 100px;
  height: 100px;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}

.room-page__chat-pulse-wave {
  position: absolute;
  right: -100px;
  top: -100px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 3px solid var(--accent-color);
  opacity: 0;
  animation: room-chat-pulse-wave 2s ease-out;
}

.room-page__chat-pulse-wave--1 { animation-delay: 0s; }
.room-page__chat-pulse-wave--2 { animation-delay: 0.4s; }
.room-page__chat-pulse-wave--3 { animation-delay: 0.8s; }

@keyframes room-chat-pulse-wave {
  0% {
    transform: scale(0.25);
    opacity: 0.7;
  }
  100% {
    transform: scale(1.1);
    opacity: 0;
  }
}

.chat-pulse-enter-active,
.chat-pulse-leave-active {
  transition: opacity 0.3s ease;
}

.chat-pulse-enter-from,
.chat-pulse-leave-to {
  opacity: 0;
}

.chat-pulse-enter-to,
.chat-pulse-leave-from {
  opacity: 1;
}

.room-page__actions {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.room-page__action-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.65);
  border: none;
  border-radius: 12px;
  color: var(--text-color);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.2s, transform 0.15s;
}

.room-page__action-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

.room-page__action-btn--active {
  background: var(--color-primary);
  color: #fff;
}

.room-page__action-icon {
  font-size: 24px;
}

.room-page__avatars {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.room-page__avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.room-page__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 20px;
}

.room-page__panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 380px;
  max-width: 100%;
  z-index: 3;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.4);
}

.room-page__panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--bg-secondary);
}

.room-page__panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.room-page__panel-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 22px;
  transition: color 0.15s, background 0.15s;
}

.room-page__panel-close:hover {
  color: var(--text-color);
  background: var(--bg-secondary);
}

.room-page__panel-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.room-page__panel-content :deep(.av-chat-window) {
  max-width: none;
  width: 100%;
  height: 100%;
  min-height: 320px;
}

.room-page__loading {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
}

.room-page--loading,
.room-page--error {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-secondary);
}

/* Анимация выезжания панелей справа */
.room-panel-enter-active,
.room-panel-leave-active {
  transition: transform 0.25s ease;
}

.room-panel-enter-from,
.room-panel-leave-to {
  transform: translateX(100%);
}

.room-panel-enter-to,
.room-panel-leave-from {
  transform: translateX(0);
}

@media (max-width: 479px) {
  .room-page__panel {
    width: 100%;
  }
}
</style>

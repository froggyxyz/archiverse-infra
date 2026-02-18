<script setup lang="ts">
import type { RoomPlaylistItem } from '~/types/room'

definePageMeta({
  auth: true,
})

const route = useRoute()
const roomId = computed(() => route.params.id as string)

const activeTab = ref<'playlist' | 'chat' | 'participants'>('playlist')
const isAddModalOpen = ref(false)

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
  setupSocketListeners,
  addToPlaylist,
  removeFromPlaylist,
  reorderPlaylist,
  getMediaViewUrl,
} = useRooms(roomId)

const videoPlayerRef = ref<{ applyRemoteState: (s: { playing?: boolean; currentTime?: number }) => void } | null>(null)
const currentMediaId = ref<string | null>(null)

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

const onPlayerStateChange = (state: { playing?: boolean; currentTime?: number }) => {
  emitPlayerState({
    ...state,
    mediaId: currentMediaId.value ?? undefined,
  })
}

const loadVideoByMediaId = async (mediaId: string) => {
  const url = await getMediaViewUrl(mediaId)
  if (url) {
    currentMediaId.value = mediaId
    videoUrl.value = url
    emitPlayerState({ mediaId })
  }
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
  removeFromPlaylist(itemId).catch((e) => addError((e as Error)?.message ?? 'Не удалось удалить'))
}

const onPlaylistReorder = (itemIds: string[]) => {
  reorderPlaylist(itemIds).catch((e) => addError((e as Error)?.message ?? 'Не удалось изменить порядок'))
}

const excludeMediaIds = computed(() => playlist.value.map((p) => p.mediaId))

onMounted(async () => {
  const r = await fetchRoom()
  if (!r) return
  await Promise.all([fetchPlaylist(), fetchMessages(), fetchParticipants()])
  connectSocket()
  nextTick(() => {
    joinRoom()
    setupSocketListeners()
    playerStateTeardown = setupPlayerStateListener((state) => {
      if (state.mediaId && state.mediaId !== currentMediaId.value) {
        loadVideoByMediaId(state.mediaId)
      }
      videoPlayerRef.value?.applyRemoteState({
        playing: state.playing,
        currentTime: state.currentTime,
      })
    })
  })
})

let playerStateTeardown: (() => void) | undefined

onBeforeUnmount(() => {
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
  <div v-else class="room-page">
    <div class="room-page__player">
      <WidgetVideoPlayer
        ref="videoPlayerRef"
        :video="videoUrl"
        :name="`Комната ${roomId}`"
        @state-change="onPlayerStateChange"
      />
    </div>

    <aside class="room-page__sidebar">
      <div v-if="room" class="room-page__invite">
        <span class="room-page__invite-code">{{ room.inviteCode }}</span>
        <button
          type="button"
          class="room-page__invite-copy"
          :aria-label="isCopyingInvite ? 'Скопировано' : 'Скопировать ссылку'"
          @click="copyInviteLink"
        >
          <Icon
            :name="isCopyingInvite ? 'mdi:check' : 'mdi:content-copy'"
            class="room-page__invite-icon"
          />
          {{ isCopyingInvite ? 'Скопировано' : 'Копировать' }}
        </button>
      </div>
      <div class="room-page__tabs">
        <button
          type="button"
          class="room-page__tab"
          :class="{ 'room-page__tab--active': activeTab === 'playlist' }"
          @click="activeTab = 'playlist'"
        >
          <Icon name="mdi:playlist-music" class="room-page__tab-icon" />
          Плейлист
        </button>
        <button
          type="button"
          class="room-page__tab"
          :class="{ 'room-page__tab--active': activeTab === 'chat' }"
          @click="activeTab = 'chat'"
        >
          <Icon name="mdi:message-outline" class="room-page__tab-icon" />
          Чат
        </button>
        <button
          type="button"
          class="room-page__tab"
          :class="{ 'room-page__tab--active': activeTab === 'participants' }"
          @click="activeTab = 'participants'"
        >
          <Icon name="mdi:account-group" class="room-page__tab-icon" />
          Участники
        </button>
      </div>

      <div class="room-page__tab-content">
        <div v-if="isLoadingPlaylist && !playlist.length" class="room-page__loading">
          Загрузка…
        </div>
        <RoomPlaylist
          v-else
          v-show="activeTab === 'playlist'"
          :items="playlistItems"
          :current-media-id="currentMediaId"
          @add="isAddModalOpen = true"
          @remove="onPlaylistRemove"
          @reorder="onPlaylistReorder"
          @select="onPlaylistSelect"
        />
        <RoomAddFromArchiveModal
          v-model="isAddModalOpen"
          :exclude-media-ids="excludeMediaIds"
          @add="onPlaylistAdd"
        />
        <div v-show="activeTab === 'participants'" class="room-page__participants">
          <div v-if="isLoadingParticipants && !participants.length" class="room-page__loading">
            Загрузка…
          </div>
          <ul v-else class="room-page__participants-list">
            <li
              v-for="p in participants"
              :key="p.id"
              class="room-page__participant"
            >
              <img
                v-if="p.avatarUrl"
                :src="p.avatarUrl"
                :alt="p.username"
                class="room-page__participant-avatar"
              >
              <div v-else class="room-page__participant-avatar room-page__participant-avatar--placeholder">
                <Icon name="mdi:account" />
              </div>
              <span class="room-page__participant-name">{{ p.username }}</span>
            </li>
          </ul>
        </div>
        <div v-show="activeTab === 'chat'" class="room-page__chat-wrap">
          <WidgetChatWindow
            user-name="Чат комнаты"
            :messages="chatMessages"
            :disabled="isLoadingMessages"
            input-placeholder="Сообщение в комнату…"
            @send="onChatSend"
          />
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.room-page {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.room-page__player {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: stretch;
}

.room-page__player :deep(.av-video-player) {
  width: 100%;
  height: 100%;
}

.room-page__sidebar {
  width: 400px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--bg-secondary);
  background-color: var(--bg-color);
  min-height: 0;
}

.room-page__invite {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--bg-secondary);
}

.room-page__invite-code {
  font-size: 14px;
  font-weight: 600;
  font-family: monospace;
  color: var(--text-color);
  letter-spacing: 0.05em;
}

.room-page__invite-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.room-page__invite-copy:hover {
  color: var(--text-color);
  background: rgba(255, 255, 255, 0.08);
}

.room-page__invite-icon {
  font-size: 18px;
}

.room-page__loading {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
}

.room-page__tabs {
  flex-shrink: 0;
  display: flex;
  gap: 4px;
  padding: 12px 12px 0;
  border-bottom: 1px solid var(--bg-secondary);
}

.room-page__tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: color 0.15s, background 0.15s;
}

.room-page__tab:hover {
  color: var(--text-color);
  background: rgba(255, 255, 255, 0.04);
}

.room-page__tab--active {
  color: var(--text-color);
  background: var(--bg-secondary);
}

.room-page__tab-icon {
  font-size: 20px;
}

.room-page__tab-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.room-page__chat-wrap {
  height: 100%;
  min-height: 400px;
}

.room-page__chat-wrap :deep(.av-chat-window) {
  max-width: none;
  width: 100%;
  height: 100%;
  min-height: 400px;
}

.room-page__participants {
  padding: 0;
}

.room-page__participants-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-page__participant {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.room-page__participant-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.room-page__participant-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: var(--text-secondary);
}

.room-page__participant-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
}

.room-page--loading,
.room-page--error {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-secondary);
}

@media (max-width: 1023px) {
  .room-page {
    flex-direction: column;
  }

  .room-page__player {
    min-height: 200px;
    aspect-ratio: 16 / 9;
  }

  .room-page__sidebar {
    width: 100%;
    flex: 1;
    min-height: 0;
  }
}
</style>

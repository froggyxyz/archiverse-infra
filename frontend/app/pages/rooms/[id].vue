<script setup lang="ts">
import type { ChatWindowMessage } from '~/types/chat'
import type { RoomPlaylistItem } from '~/types/room'

definePageMeta({
  auth: true,
})

const route = useRoute()
const roomId = computed(() => route.params.id as string)

const activeTab = ref<'playlist' | 'chat'>('playlist')

const playlistItems = ref<RoomPlaylistItem[]>([
  { id: '1', title: 'Sunset timelapse.mp4', duration: '2:34', thumbnailUrl: null },
  { id: '2', title: 'Лекция по Vue 3', duration: '1:15:22', thumbnailUrl: null },
  { id: '3', title: 'Музыкальный клип', duration: '4:12', thumbnailUrl: null },
])

const chatMessages = ref<ChatWindowMessage[]>([
  { text: 'Привет всем!', isOwn: false, senderName: 'Alex', createdAt: new Date() },
  { text: 'Привет!', isOwn: true, createdAt: new Date() },
])

const onChatSend = (text: string) => {
  chatMessages.value.push({
    text,
    isOwn: true,
    createdAt: new Date(),
  })
}

// Demo video URL — пусто для заглушки, можно подставить HLS-ссылку
const videoUrl = ref('')
</script>

<template>
  <div class="room-page">
    <div class="room-page__player">
      <WidgetVideoPlayer
        :video="videoUrl"
        :name="`Комната ${roomId}`"
      />
    </div>

    <aside class="room-page__sidebar">
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
      </div>

      <div class="room-page__tab-content">
        <RoomPlaylist v-show="activeTab === 'playlist'" :items="playlistItems" />
        <div v-show="activeTab === 'chat'" class="room-page__chat-wrap">
          <WidgetChatWindow
            user-name="Чат комнаты"
            :messages="chatMessages"
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

<script setup lang="ts">
import type { ChatWindowMessage } from '~/types/chat'
import type { ChatListItem } from '~/types/chat'
import { formatChatListDate } from '~/utils/format-date'

definePageMeta({
  auth: true,
})

const selectedChatId = ref<string | null>(null)

const {
  chatList,
  isLoadingChats,
  isLoadingMessages,
  fetchChats,
  fetchMessages,
  sendMessage,
  markRead,
  getMessages,
} = useChats(selectedChatId)
const selectedChat = computed<ChatListItem | null>(() =>
  chatList.value?.find((c) => c.id === selectedChatId.value) ?? null
)

const messages = computed<ChatWindowMessage[]>(() =>
  selectedChatId.value ? getMessages(selectedChatId.value) : []
)

const selectChat = async (chat: ChatListItem) => {
  selectedChatId.value = chat.id
  await fetchMessages(chat.id, chat.otherUser.username)
  await markRead(chat.id)
}

const onSend = (text: string) => {
  if (!selectedChatId.value) return
  sendMessage(selectedChatId.value, text)
}

const route = useRoute()

const onVisibilityChange = () => {
  if (document.visibilityState === 'visible' && selectedChatId.value) {
    void markRead(selectedChatId.value)
  }
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  await fetchChats()
  const chatIdFromQuery = route.query.chat as string | undefined
  if (chatIdFromQuery) {
    const chat = chatList.value?.find((c) => c.id === chatIdFromQuery)
    if (chat) {
      await selectChat(chat)
    }
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="chats-page">
    <aside class="chats-page__sidebar">
      <h1 class="chats-page__title">Чаты</h1>
      <div v-if="isLoadingChats" class="chats-page__loading">Загрузка…</div>
      <ul v-else-if="chatList?.length" class="chats-page__list">
        <li
          v-for="chat in chatList"
          :key="chat.id"
          class="chats-page__item"
          :class="{ 'chats-page__item--active': chat.id === selectedChatId }"
          @click="selectChat(chat)"
        >
          <img
            v-if="chat.otherUser.avatarUrl"
            :src="chat.otherUser.avatarUrl"
            :alt="chat.otherUser.username"
            class="chats-page__avatar"
          >
          <div v-else class="chats-page__avatar chats-page__avatar--placeholder">
            <Icon name="mdi:account" class="chats-page__avatar-icon" />
          </div>
          <div class="chats-page__item-body">
            <div class="chats-page__item-head">
              <span class="chats-page__name">{{ chat.otherUser.username }}</span>
              <span class="chats-page__item-meta">
                <span v-if="chat.unreadCount > 0" class="chats-page__badge">{{ chat.unreadCount }}</span>
                <time class="chats-page__time">{{ formatChatListDate(chat.lastMessageAt) }}</time>
              </span>
            </div>
            <p class="chats-page__preview">
              {{ chat.lastMessage?.text ?? (chat.lastMessage?.attachmentPreview ? '[Медиа]' : 'Нет сообщений') }}
            </p>
          </div>
        </li>
      </ul>
      <p v-else class="chats-page__empty">Нет чатов</p>
    </aside>

    <main class="chats-page__main">
      <template v-if="selectedChat">
        <WidgetChatWindow
          :user-name="selectedChat.otherUser.username"
          :avatar-url="selectedChat.otherUser.avatarUrl"
          :user-slug="selectedChat.otherUser.username"
          :messages="messages"
          :disabled="isLoadingMessages"
          show-close-button
          @send="onSend"
          @close="selectedChatId = null"
        />
      </template>
      <div v-else class="chats-page__placeholder">
        <p>Выберите чат</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.chats-page {
  display: flex;
  min-height: 100vh;
  height: 100vh;
}

.chats-page__sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--bg-secondary);
  overflow: hidden;
}

.chats-page__title {
  font-size: 20px;
  font-weight: 600;
  padding: 16px;
  border-bottom: 1px solid var(--bg-secondary);
}

.chats-page__loading,
.chats-page__empty {
  padding: 24px;
  color: var(--text-secondary);
}

.chats-page__list {
  flex: 1;
  overflow-y: auto;
}

.chats-page__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--bg-secondary);
  transition: background 0.15s;
}

.chats-page__item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.chats-page__item--active {
  background: rgba(255, 255, 255, 0.06);
}

.chats-page__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.chats-page__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
}

.chats-page__avatar-icon {
  font-size: 28px;
  color: var(--text-secondary);
}

.chats-page__item-body {
  flex: 1;
  min-width: 0;
  position: relative;
}

.chats-page__item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.chats-page__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chats-page__item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.chats-page__time {
  font-size: 12px;
  color: var(--text-secondary);
}

.chats-page__preview {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 2px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chats-page__badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  background: var(--accent-color);
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chats-page__main {
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-width: 0;
  min-height: 0;
}

.chats-page__main :deep(.av-chat-window) {
  max-width: none;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.chats-page__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
}
</style>

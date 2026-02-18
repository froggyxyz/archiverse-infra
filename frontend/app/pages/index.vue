<script setup lang="ts">
import type { ChatWindowMessage } from '~/types/chat'
import type { RoomPlaylistItem } from '~/types/room'

const selectedFiles = ref<File[]>([])

const roomPlaylistExample: RoomPlaylistItem[] = [
  { id: '1', mediaId: '1', title: 'Sunset timelapse.mp4', duration: '2:34', thumbnailUrl: null },
  { id: '2', mediaId: '2', title: 'Лекция по Vue 3', duration: '1:15:22', thumbnailUrl: null },
  { id: '3', mediaId: '3', title: 'Музыкальный клип', duration: '4:12', thumbnailUrl: null },
]
const fileInputError = ref('')

const chatMessages = ref<ChatWindowMessage[]>([
    {
        text: 'Привет! Как дела?',
        isOwn: false,
        senderName: 'Alex',
        createdAt: new Date(),
    },
    {
        text: 'Привет! Всё отлично, спасибо. А у тебя?',
        isOwn: true,
        createdAt: new Date(),
    },
    {
        text: 'Тоже всё хорошо.\nЗавтра созвонимся?',
        isOwn: false,
        senderName: 'Alex',
        createdAt: new Date(),
    },
])

const { createAndGo } = useCreateRoom()

const onChatSend = (text: string) => {
    chatMessages.value.push({
        text,
        isOwn: true,
        createdAt: new Date(),
    })
}
</script>

<template>
  <div>
    <h1>Hello World</h1>
    <UiFileInput
      v-model="selectedFiles"
      label="Медиафайлы"
      hint="Перетащите сюда или нажмите (до 10 файлов: аудио, видео, изображения)"
      :error="fileInputError"
      @error="fileInputError = $event"
    />
    <UiButton href="/login">
      Вход
    </UiButton>
    <UiButton href="/register">
      Регистрация
    </UiButton>
    <UiButton href="/dashboard">
      Dashboard
    </UiButton>
    <UiButton @click="createAndGo">
      Комната
    </UiButton>
    <UiButton href="/">
      Click me
    </UiButton>
    <UiButton size="sm">
      Click me
    </UiButton>
    <UiButton size="md">
      Click me
    </UiButton>
    <UiButton size="lg">
      Click me
    </UiButton>
    <UiInput name="name" label="Name" placeholder="Enter your name" />
    <UiInput name="password" label="Password" placeholder="Enter your password" type="password" />
    <UiTextarea name="description" label="Description" placeholder="Enter your description" />
    <UiCheckbox name="checkbox" label="Checkbox" />
    <div style="margin-top: 24px; max-width: 640px;">
      <h2 style="font-size: 18px; margin-bottom: 16px;">Плейлист комнаты</h2>
      <RoomPlaylist :items="roomPlaylistExample" />
    </div>
    <div style="margin-top: 24px;">
      <h2 style="font-size: 18px; margin-bottom: 16px;">Чат</h2>
      <WidgetChatWindow
        user-name="Alex"
        :messages="chatMessages"
        @send="onChatSend"
      />
    </div>
  </div>
</template>

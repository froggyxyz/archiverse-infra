<script setup lang="ts">
import type { ChatWindowMessage } from '~/types/chat'

const selectedFiles = ref<File[]>([])
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

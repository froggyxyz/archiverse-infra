<script setup lang="ts">
const selectedFiles = ref<File[]>([])
const fileInputError = ref('')
const messageText = ref('')

const onSendMessage = (text: string) => {
  console.log('Send:', text)
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
    <div style="max-width: 400px; margin-top: 16px;">
      <UiChatMessageInput
        v-model="messageText"
        placeholder="Сообщение…"
        @send="onSendMessage"
      />
    </div>
  </div>
</template>

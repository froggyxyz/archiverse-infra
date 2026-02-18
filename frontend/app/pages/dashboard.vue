<script setup lang="ts">
definePageMeta({
  auth: true,
})

const { user, logout } = useAuth()
const { createAndGo } = useCreateRoom()
</script>

<template>
  <div>
    <h1>Dashboard</h1>
    <p v-if="user">
      Добро пожаловать, {{ user.username }}
    </p>
    <UiButton v-if="user" :href="`/profile/${user.username}`">
      Мой профиль
    </UiButton>
    <UiButton v-if="user" href="/chats">
      Чаты
    </UiButton>
    <UiButton v-if="user" @click="createAndGo">
      Комната
    </UiButton>
    <UiButton @click="logout()">
      Выйти
    </UiButton>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  auth: true,
})

const { user, logout } = useAuth()
</script>

<template>
  <div>
    <h1>Dashboard</h1>
    <p v-if="user">
      Добро пожаловать, {{ user.username }}
    </p>
    <UiButton @click="logout()">
      Выйти
    </UiButton>
  </div>
</template>

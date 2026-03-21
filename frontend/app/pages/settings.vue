<script setup lang="ts">
definePageMeta({
  auth: true,
})

const { logout } = useAuth()
const isLoggingOut = ref(false)

const onLogout = async () => {
  if (isLoggingOut.value) return
  isLoggingOut.value = true
  try {
    await logout()
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <h1 class="settings-page__title">
      Настройки
    </h1>
    <section class="settings-page__section">
      <UiButton
        type="button"
        width="full"
        size="lg"
        :disabled="isLoggingOut"
        @click="onLogout"
      >
        {{ isLoggingOut ? 'Выход…' : 'Выйти' }}
      </UiButton>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-page__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-color);
}

.settings-page__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>

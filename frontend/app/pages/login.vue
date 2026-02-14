<script setup lang="ts">
definePageMeta({
  auth: 'optional',
})

const { login, isAuthenticated } = useAuth()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const redirectTo = computed(() => (route.query.redirect as string) ?? '/')

const handleSubmit = async () => {
  errorMessage.value = ''
  isLoading.value = true
  try {
    await login({ username: username.value, password: password.value })
    await router.push(redirectTo.value)
  } catch (e) {
    errorMessage.value = (e as { data?: { message?: string } })?.data?.message ?? 'Ошибка входа'
  } finally {
    isLoading.value = false
  }
}

watch(isAuthenticated, (auth) => {
  if (auth) router.push(redirectTo.value)
}, { immediate: true })
</script>

<template>
  <div class="login-page">
    <form class="login-form" @submit.prevent="handleSubmit">
      <h1>Вход</h1>
      <UiInput
        v-model="username"
        type="text"
        name="username"
        label="Имя пользователя"
        placeholder="username"
        required
      />
      <UiInput
        v-model="password"
        type="password"
        name="password"
        label="Пароль"
        placeholder="••••••••"
        required
      />
      <p v-if="errorMessage" class="error">
        {{ errorMessage }}
      </p>
      <UiButton type="submit" width="full" size="lg" :disabled="isLoading">
        {{ isLoading ? 'Вход...' : 'Войти' }}
      </UiButton>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-form {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.error {
  color: var(--color-error, #ef4444);
  font-size: 0.875rem;
}
</style>

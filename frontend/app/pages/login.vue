<script setup lang="ts">
definePageMeta({
  auth: 'optional',
})

const { login, isAuthenticated } = useAuth()
const { addError, addInfo, clear } = useAlerts()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const isLoading = ref(false)

const redirectTo = computed(() => (route.query.redirect as string) ?? '/')

const handleSubmit = async () => {
  clear()
  isLoading.value = true
  try {
    await login({ username: username.value, password: password.value })
    await router.push(redirectTo.value)
  } catch (e) {
    addError((e as { data?: { message?: string } })?.data?.message ?? 'Ошибка входа')
  } finally {
    isLoading.value = false
  }
}

watch(isAuthenticated, (auth) => {
  if (auth) router.push(redirectTo.value)
}, { immediate: true })

onMounted(() => {
  if (route.query.session_expired === '1') {
    addInfo('Сессия истекла. Войдите снова.')
  }
})
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
      <UiButton type="submit" width="full" size="lg" :disabled="isLoading">
        {{ isLoading ? 'Вход...' : 'Войти' }}
      </UiButton>
      <NuxtLink to="/register" class="link">
        Нет аккаунта? Зарегистрироваться
      </NuxtLink>
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

.link {
  font-size: 0.875rem;
  text-align: center;
  color: var(--accent-color, #6366f1);
}
</style>

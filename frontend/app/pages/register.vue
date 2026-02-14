<script setup lang="ts">
import { validateUsername, validatePassword } from '~/utils/register-validate'

definePageMeta({
  auth: 'optional',
})

const { register, isAuthenticated } = useAuth()
const { addError, addInfo, clear } = useAlerts()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const passwordConfirm = ref('')
const isLoading = ref(false)
const usernameError = ref('')
const passwordError = ref('')
const passwordConfirmError = ref('')

const redirectTo = computed(() => (route.query.redirect as string) ?? '/')

const validateForm = (): boolean => {
  usernameError.value = validateUsername(username.value) ?? ''
  passwordError.value = validatePassword(password.value) ?? ''
  passwordConfirmError.value =
    password.value !== passwordConfirm.value ? 'Пароли не совпадают' : ''

  return !usernameError.value && !passwordError.value && !passwordConfirmError.value
}

const handleSubmit = async () => {
  clear()
  usernameError.value = ''
  passwordError.value = ''
  passwordConfirmError.value = ''

  if (!validateForm()) {
    addInfo('Проверьте правильность заполнения полей')
    return
  }

  isLoading.value = true
  try {
    await register({ username: username.value, password: password.value })
    await router.push(redirectTo.value)
  } catch (e) {
    const err = e as { statusCode?: number; data?: { message?: string | string[] } }
    if (err.statusCode === 409) {
      addError('Имя пользователя уже занято')
    } else {
      const msg = err.data?.message
      addError(Array.isArray(msg) ? msg[0] ?? 'Ошибка регистрации' : msg ?? 'Ошибка регистрации')
    }
  } finally {
    isLoading.value = false
  }
}

watch(isAuthenticated, (auth) => {
  if (auth) router.push(redirectTo.value)
}, { immediate: true })
</script>

<template>
  <div class="register-page">
    <form class="register-form" @submit.prevent="handleSubmit">
      <h1>Регистрация</h1>
      <UiInput
        v-model="username"
        type="text"
        name="username"
        label="Имя пользователя"
        placeholder="username"
        :error="usernameError"
        required
      />
      <UiInput
        v-model="password"
        type="password"
        name="password"
        label="Пароль"
        placeholder="••••••••"
        :error="passwordError"
        required
      />
      <UiInput
        v-model="passwordConfirm"
        type="password"
        name="passwordConfirm"
        label="Подтверждение пароля"
        placeholder="••••••"
        :error="passwordConfirmError"
        required
      />
      <UiButton type="submit" width="full" size="lg" :disabled="isLoading">
        {{ isLoading ? 'Регистрация...' : 'Зарегистрироваться' }}
      </UiButton>
      <NuxtLink to="/login" class="link">
        Уже есть аккаунт? Войти
      </NuxtLink>
    </form>
  </div>
</template>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.register-form {
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

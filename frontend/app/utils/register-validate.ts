const USERNAME_MIN = 2
const USERNAME_MAX = 32
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/
const PASSWORD_MIN = 8

export const validateUsername = (value: string): string | null => {
  if (value.length < USERNAME_MIN) {
    return `Имя пользователя должно быть не менее ${USERNAME_MIN} символов`
  }
  if (value.length > USERNAME_MAX) {
    return `Имя пользователя должно быть не более ${USERNAME_MAX} символов`
  }
  if (!USERNAME_PATTERN.test(value)) {
    return 'Только латинские буквы, цифры, подчёркивание и дефис'
  }
  return null
}

export const validatePassword = (value: string): string | null => {
  if (value.length < PASSWORD_MIN) {
    return `Пароль должен быть не менее ${PASSWORD_MIN} символов`
  }
  return null
}

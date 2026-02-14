<script setup lang="ts">
import { AUTH_ROUTES } from '~/lib/auth/constants'

const error = useError()
const statusCode = computed(() => (error.value as { statusCode?: number })?.statusCode ?? 500)

type ActionWithHref = { label: string; href: string }
type ActionWithAction = { label: string; action: string }

const errorConfig = computed(() => {
  const code = statusCode.value
  switch (code) {
    case 404:
      return {
        title: 'Страница не найдена',
        description: 'Запрашиваемая страница не существует или была перемещена.',
        primaryAction: { label: 'На главную', href: AUTH_ROUTES.HOME } as ActionWithHref,
        secondaryAction: { label: 'Назад', action: 'back' } as ActionWithAction,
      }
    case 401:
    case 403:
      return {
        title: 'Доступ запрещён',
        description: 'У вас нет прав для просмотра этой страницы.',
        primaryAction: { label: 'Войти', href: AUTH_ROUTES.LOGIN } as ActionWithHref,
        secondaryAction: { label: 'На главную', href: AUTH_ROUTES.HOME } as ActionWithHref,
      }
    default:
      return {
        title: 'Что-то пошло не так',
        description: (error.value as { message?: string })?.message ?? 'Произошла ошибка. Попробуйте обновить страницу.',
        primaryAction: { label: 'Обновить', action: 'retry' } as ActionWithAction,
        secondaryAction: { label: 'На главную', href: AUTH_ROUTES.HOME } as ActionWithHref,
      }
  }
})

const clearErrorAndGo = (path?: string) => {
  clearError({ redirect: path })
}

const handleRetry = () => {
  clearError()
  window.location.reload()
}

const handleBack = () => {
  clearError()
  if (typeof history !== 'undefined' && history.length > 1) {
    history.back()
  } else {
    navigateTo(AUTH_ROUTES.HOME)
  }
}

const handleAction = (action: string) => {
  if (action === 'retry') handleRetry()
  else if (action === 'back') handleBack()
}
</script>

<template>
  <div class="error-page">
    <div class="error-page__content">
      <div class="error-page__code glitch" :data-text="String(statusCode)">
        {{ statusCode }}
      </div>
      <h1 class="error-page__title">
        {{ errorConfig.title }}
      </h1>
      <p class="error-page__description">
        {{ errorConfig.description }}
      </p>
      <div class="error-page__actions">
        <UiButton
          v-if="'href' in errorConfig.primaryAction"
          :href="errorConfig.primaryAction.href"
          size="lg"
          @click.prevent="clearErrorAndGo(errorConfig.primaryAction.href)"
        >
          {{ errorConfig.primaryAction.label }}
        </UiButton>
        <UiButton
          v-else
          size="lg"
          @click="handleAction(errorConfig.primaryAction.action)"
        >
          {{ errorConfig.primaryAction.label }}
        </UiButton>
        <UiButton
          v-if="errorConfig.secondaryAction"
          :href="'href' in errorConfig.secondaryAction ? errorConfig.secondaryAction.href : undefined"
          size="lg"
          @click.prevent="'href' in errorConfig.secondaryAction ? clearErrorAndGo(errorConfig.secondaryAction.href) : handleAction(errorConfig.secondaryAction.action)"
        >
          {{ errorConfig.secondaryAction.label }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.error-page__content {
  max-width: 480px;
  text-align: center;
}

.error-page__code {
  font-family: 'Roboto Mono', monospace;
  font-size: clamp(8rem, 25vw, 14rem);
  font-weight: 700;
  line-height: 1;
  color: var(--text-color);
  margin-bottom: 1rem;
  position: relative;
}

.glitch {
  position: relative;
}

.glitch::before,
.glitch::after {
  content: attr(data-text);
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: transparent;
}

.glitch::before {
  animation: glitch-1 0.3s infinite;
  color: #00ffff;
  z-index: -2;
  clip-path: polygon(0 0, 100% 0, 100% 35%, 0 35%);
  transform: translate(-2px, 2px);
}

.glitch::after {
  animation: glitch-2 0.4s infinite;
  color: #ff00ff;
  z-index: -1;
  clip-path: polygon(0 65%, 100% 65%, 100% 100%, 0 100%);
  transform: translate(2px, -2px);
}

@keyframes glitch-1 {
  0% {
    transform: translate(-2px, 2px);
    opacity: 0.8;
  }
  20% {
    transform: translate(2px, -2px);
    opacity: 0.8;
  }
  40% {
    transform: translate(-2px, -2px);
    opacity: 0.8;
  }
  60% {
    transform: translate(2px, 2px);
    opacity: 0.8;
  }
  80% {
    transform: translate(-2px, 2px);
    opacity: 0.8;
  }
  100% {
    transform: translate(-2px, 2px);
    opacity: 0.8;
  }
}

@keyframes glitch-2 {
  0% {
    transform: translate(2px, -2px);
    opacity: 0.8;
  }
  20% {
    transform: translate(-2px, 2px);
    opacity: 0.8;
  }
  40% {
    transform: translate(2px, 2px);
    opacity: 0.8;
  }
  60% {
    transform: translate(-2px, -2px);
    opacity: 0.8;
  }
  80% {
    transform: translate(2px, -2px);
    opacity: 0.8;
  }
  100% {
    transform: translate(2px, -2px);
    opacity: 0.8;
  }
}

.error-page__code {
  animation: glitch-main 2s infinite;
}

@keyframes glitch-main {
  0%, 90%, 100% {
    transform: translate(0);
    text-shadow: none;
  }
  92% {
    transform: translate(-2px, 1px);
    text-shadow: 2px 0 #00ffff, -2px 0 #ff00ff;
  }
  94% {
    transform: translate(2px, -1px);
    text-shadow: -2px 0 #ff00ff, 2px 0 #00ffff;
  }
  96% {
    transform: translate(-1px, 2px);
    text-shadow: 1px 0 #00ffff, -1px 0 #ff00ff;
  }
  98% {
    transform: translate(1px, -2px);
    text-shadow: -1px 0 #ff00ff, 1px 0 #00ffff;
  }
}

.error-page__title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.error-page__description {
  color: var(--text-secondary);
  font-size: 1rem;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.error-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
}

.error-page__actions :deep(.av-btn) {
  flex: 1;
  min-width: 140px;
}
</style>

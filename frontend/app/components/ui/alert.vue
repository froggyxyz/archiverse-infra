<template>
  <div :class="['av-alert', `av-alert--${type}`]">
    <Icon :name="typeIcon" class="av-alert__type-icon" />
    <span class="av-alert__message">{{ message }}</span>
    <button
      type="button"
      class="av-alert__dismiss"
      aria-label="Закрыть"
      @click="$emit('dismiss')"
    >
      <Icon name="mdi:close" class="av-alert__icon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ALERT_TYPES } from '~/types/alert'
import type { AlertType } from '~/types/alert'

const props = defineProps<{
  type: AlertType
  message: string
}>()

defineEmits<{
  dismiss: []
}>()

const TYPE_ICONS: Record<AlertType, string> = {
  [ALERT_TYPES.ERROR]: 'material-symbols:error-circle-rounded-outline-sharp',
  [ALERT_TYPES.SUCCESS]: 'clarity:success-standard-line',
  [ALERT_TYPES.INFO]: 'material-symbols:info-outline-rounded',
}

const typeIcon = computed(() => TYPE_ICONS[props.type])
</script>

<style scoped>
.av-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.av-alert--success {
  background-color: var(--bg-color);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #22c55e;
}

.av-alert--error {
  background-color: var(--bg-color);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.av-alert--info {
  background-color: var(--bg-color);
  border: 1px solid rgba(59, 130, 246, 0.4);
  color: #3b82f6;
}

.av-alert__type-icon {
  flex-shrink: 0;
  font-size: 1.25rem;
}

.av-alert__message {
  flex: 1;
}

.av-alert__dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.8;
}

.av-alert__dismiss:hover {
  opacity: 1;
}

.av-alert__icon {
  font-size: 1.25rem;
}
</style>

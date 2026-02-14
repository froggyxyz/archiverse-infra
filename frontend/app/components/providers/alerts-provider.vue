<template>
  <div class="alerts-provider">
    <slot />
    <Teleport to="body">
      <div v-if="alerts.length" class="alerts-container">
        <TransitionGroup name="alerts">
          <UiAlert
            v-for="alert in alerts"
            :key="alert.id"
            :type="alert.type"
            :message="alert.message"
            @dismiss="remove(alert.id)"
          />
        </TransitionGroup>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const { alerts, remove } = provideAlerts()
</script>

<style scoped>
.alerts-provider {
  position: relative;
  width: 100%;
  min-height: 100%;
}

.alerts-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: min(400px, calc(100vw - 2rem));
}

.alerts-enter-active,
.alerts-leave-active {
  transition: all 0.3s ease;
}

.alerts-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.alerts-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.alerts-move {
  transition: transform 0.3s ease;
}
</style>

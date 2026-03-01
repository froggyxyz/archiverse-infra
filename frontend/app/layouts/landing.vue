<template>
  <div class="landing-layout">
    <LayoutAppHeader />
    <main class="landing-layout__main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.landing-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.landing-layout__main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>

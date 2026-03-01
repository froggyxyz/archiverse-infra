<template>
    <div class="room-layout">
        <main class="room-layout__main">
            <slot />
        </main>
    </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.room-layout {
    min-height: 100vh;
    height: 100vh;
    display: flex;
    flex-direction: column;
}

.room-layout__main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
</style>

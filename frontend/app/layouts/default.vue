<template>
    <div class="app-layout">
        <LayoutAppHeader />
        <main class="app-layout__main">
            <div class="app-layout__content">
                <slot />
            </div>
        </main>
        <LayoutAppTabbar />
    </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.app-layout {
    min-height: 100vh;
    height: 100vh;
    display: flex;
    flex-direction: column;
}

.app-layout__main {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding-bottom: 0;
}

.app-layout__content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

@media (max-width: 1023px) {
    .app-layout__main {
        padding-bottom: 56px;
    }
}
</style>

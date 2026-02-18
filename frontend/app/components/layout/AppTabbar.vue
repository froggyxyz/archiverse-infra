<template>
    <nav class="app-tabbar">
        <NuxtLink
            to="/"
            class="app-tabbar__item"
            active-class="app-tabbar__item--active"
        >
            <Icon name="mdi:home-outline" class="app-tabbar__icon" />
            <span class="app-tabbar__label">Главная</span>
        </NuxtLink>
        <NuxtLink
            v-if="user"
            to="/chats"
            class="app-tabbar__item"
            active-class="app-tabbar__item--active"
        >
            <Icon name="mdi:message-outline" class="app-tabbar__icon" />
            <span class="app-tabbar__label">Чаты</span>
        </NuxtLink>
        <button
            v-if="user"
            type="button"
            class="app-tabbar__item"
            @click="createAndGo"
        >
            <Icon name="mdi:video-outline" class="app-tabbar__icon" />
            <span class="app-tabbar__label">Комната</span>
        </button>
        <NuxtLink
            v-if="user"
            :to="`/profile/${encodeURIComponent(user.username)}`"
            class="app-tabbar__item"
            active-class="app-tabbar__item--active"
        >
            <Icon name="mdi:account-outline" class="app-tabbar__icon" />
            <span class="app-tabbar__label">Профиль</span>
        </NuxtLink>
    </nav>
</template>

<script setup lang="ts">
const { user } = useAuthTokens()
const { createAndGo } = useCreateRoom()
</script>

<style scoped>
.app-tabbar {
    display: flex;
}

@media (min-width: 1024px) {
    .app-tabbar {
        display: none;
    }
}

@media (max-width: 1023px) {
    .app-tabbar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 100;
        display: flex;
        justify-content: space-around;
        align-items: center;
        height: 56px;
        padding: 0 16px;
        border-top: 1px solid var(--bg-secondary);
        background-color: var(--bg-color);
    }

    .app-tabbar__item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 8px 16px;
        font-size: 12px;
        color: var(--text-secondary);
        text-decoration: none;
        border-radius: 8px;
    }

    .app-tabbar__item:hover {
        color: var(--text-color);
    }

    .app-tabbar__item--active {
        color: var(--accent-color);
    }

    .app-tabbar__icon {
        font-size: 24px;
    }
}
</style>

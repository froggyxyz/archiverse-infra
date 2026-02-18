<template>
    <header class="app-header">
        <NuxtLink to="/" class="app-header__logo">ARCHIVERSE</NuxtLink>
        <div class="app-header__right">
            <NuxtLink
                v-if="user"
                to="/chats"
                class="app-header__chats-link app-header__chats-link--visible"
            >
                <Icon name="mdi:message-outline" class="app-header__chats-icon" />
                <span class="app-header__chats-text">Чаты</span>
            </NuxtLink>
            <button
                v-if="user"
                type="button"
                class="app-header__room-btn"
                @click="createAndGo"
            >
                <Icon name="mdi:video-outline" class="app-header__room-icon" />
                <span class="app-header__room-text">Комната</span>
            </button>
            <NuxtLink
                v-if="user"
                :to="`/profile/${encodeURIComponent(user.username)}`"
                class="app-header__avatar-link"
            >
                <img
                    v-if="profile?.avatarUrl"
                    :src="profile.avatarUrl"
                    :alt="user.username"
                    class="app-header__avatar"
                >
                <div v-else class="app-header__avatar app-header__avatar--placeholder">
                    {{ user.username.charAt(0).toUpperCase() }}
                </div>
            </NuxtLink>
            <NuxtLink
                v-else
                to="/login"
                class="app-header__login-link"
            >
                Вход
            </NuxtLink>
        </div>
    </header>
</template>

<script setup lang="ts">
const { user } = useAuthTokens()
const { createAndGo } = useCreateRoom()
const profile = ref<{ avatarUrl: string | null } | null>(null)

watch(
    user,
    async (u) => {
        if (!u || import.meta.server) {
            profile.value = null
            return
        }
        try {
            profile.value = await useApiEndpoints().users.getProfile(u.username)
        } catch {
            profile.value = null
        }
    },
    { immediate: true }
)
</script>

<style scoped>
.app-header {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    padding: 0 16px;
    border-bottom: 1px solid var(--bg-secondary);
    background-color: var(--bg-color);
}

.app-header__logo {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-color);
    text-decoration: none;
    letter-spacing: 0.05em;
}

.app-header__logo:hover {
    opacity: 0.9;
}

.app-header__right {
    display: flex;
    align-items: center;
    gap: 16px;
}

.app-header__chats-link {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color);
    text-decoration: none;
    border-radius: 6px;
}

.app-header__chats-link:hover {
    background: rgba(255, 255, 255, 0.06);
}

.app-header__chats-link--visible {
    display: none;
}

@media (min-width: 1024px) {
    .app-header__chats-link--visible {
        display: flex;
    }
}

.app-header__chats-icon {
    font-size: 20px;
}

.app-header__chats-text {
    display: inline;
}

.app-header__room-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color);
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
}

.app-header__room-btn:hover {
    background: rgba(255, 255, 255, 0.06);
}

.app-header__room-icon {
    font-size: 20px;
}

.app-header__room-text {
    display: none;
}

@media (min-width: 1024px) {
    .app-header__room-text {
        display: inline;
    }
}

.app-header__avatar-link {
    display: flex;
    border-radius: 50%;
}

.app-header__avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
}

.app-header__avatar--placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
    background: var(--bg-secondary);
    color: var(--text-color);
}

.app-header__login-link {
    padding: 6px 12px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color);
    text-decoration: none;
    border-radius: 6px;
}

.app-header__login-link:hover {
    background: rgba(255, 255, 255, 0.06);
}

</style>

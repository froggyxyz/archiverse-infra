<template>
    <div class="av-chat-window">
        <header class="av-chat-window__header">
            <button
                v-if="showBackButton"
                type="button"
                class="av-chat-window__back av-chat-window__nav-btn"
                aria-label="Назад"
                @click="emit('close')"
            >
                <Icon name="mdi:chevron-left" class="av-chat-window__back-icon" />
            </button>
            <NuxtLink
                v-if="userSlug"
                :to="`/profile/${encodeURIComponent(userSlug)}`"
                class="av-chat-window__user-link"
            >
                <img
                    v-if="avatarUrl"
                    :src="avatarUrl"
                    :alt="userName"
                    class="av-chat-window__avatar"
                >
                <div v-else class="av-chat-window__avatar av-chat-window__avatar--placeholder">
                    <Icon name="mdi:account" class="av-chat-window__avatar-icon" />
                </div>
                <span class="av-chat-window__name">{{ userName }}</span>
            </NuxtLink>
            <template v-else>
                <img
                    v-if="avatarUrl"
                    :src="avatarUrl"
                    :alt="userName"
                    class="av-chat-window__avatar"
                >
                <div v-else class="av-chat-window__avatar av-chat-window__avatar--placeholder">
                    <Icon name="mdi:account" class="av-chat-window__avatar-icon" />
                </div>
                <span class="av-chat-window__name">{{ userName }}</span>
            </template>
            <button
                v-if="showCloseButton"
                type="button"
                class="av-chat-window__close av-chat-window__nav-btn av-chat-window__nav-btn--desktop"
                aria-label="Закрыть чат"
                @click="emit('close')"
            >
                <Icon name="mdi:close" class="av-chat-window__close-icon" />
            </button>
        </header>

        <div ref="messagesRef" class="av-chat-window__messages">
            <UiChatMessageBubble
                v-for="(msg, i) in messages"
                :key="msg.id ?? i"
                :text="msg.text"
                :is-own="msg.isOwn"
                :sender-name="msg.senderName"
                :created-at="msg.createdAt"
            />
        </div>

        <div class="av-chat-window__input">
            <UiChatMessageInput
                v-model="inputText"
                :placeholder="inputPlaceholder"
                :disabled="disabled"
                @send="onSend"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ChatWindowMessage } from '~/types/chat'

interface Props {
    userName: string
    avatarUrl?: string | null
    userSlug?: string | null
    messages?: ChatWindowMessage[]
    inputPlaceholder?: string
    disabled?: boolean
    showCloseButton?: boolean
    showBackButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    messages: () => [],
    inputPlaceholder: 'Сообщение…',
    disabled: false,
    showCloseButton: false,
    showBackButton: false,
})

const emit = defineEmits<{ send: [text: string]; close: [] }>()

const inputText = ref('')
const messagesRef = ref<HTMLElement | null>(null)

const onSend = (text: string) => {
    emit('send', text)
}

const scrollToBottom = () => {
    nextTick(() => {
        if (messagesRef.value) {
            messagesRef.value.scrollTop = messagesRef.value.scrollHeight
        }
    })
}

watch(() => props.messages.length, scrollToBottom, { immediate: true })

onMounted(scrollToBottom)
</script>

<style scoped>
.av-chat-window {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 420px;
    height: 560px;
    border: 1px solid var(--bg-secondary);
    background-color: var(--bg-color);
    overflow: hidden;
}

.av-chat-window__header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--bg-secondary);
    background-color: var(--bg-secondary);
}

.av-chat-window__user-link {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: inherit;
    border-radius: 6px;
    padding: 4px 0;
    margin: -4px 0;
}

.av-chat-window__user-link:hover {
    background: rgba(255, 255, 255, 0.06);
}

.av-chat-window__back {
    flex-shrink: 0;
    padding: 4px;
    margin: -4px 4px -4px -4px;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
}

.av-chat-window__back:hover {
    color: var(--text-color);
    background: rgba(255, 255, 255, 0.08);
}

.av-chat-window__back-icon {
    font-size: 28px;
}

.av-chat-window__close {
    margin-left: auto;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
}

.av-chat-window__close:hover {
    color: var(--text-color);
    background: rgba(255, 255, 255, 0.08);
}

.av-chat-window__close-icon {
    font-size: 24px;
}

.av-chat-window__nav-btn {
    display: flex;
}

.av-chat-window__nav-btn--desktop {
    display: none;
}

@media (min-width: 1024px) {
    .av-chat-window__nav-btn {
        display: none;
    }

    .av-chat-window__nav-btn--desktop {
        display: flex;
    }
}

.av-chat-window__avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
}

.av-chat-window__avatar--placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-color);
}

.av-chat-window__avatar-icon {
    font-size: 24px;
    color: var(--text-secondary);
}

.av-chat-window__name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color);
}

.av-chat-window__messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.av-chat-window__input {
    flex-shrink: 0;
    padding: 12px 16px 16px;
    border-top: 1px solid var(--bg-secondary);
}
</style>

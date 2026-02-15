<template>
    <div class="av-message-bubble" :class="{ 'av-message-bubble--own': isOwn }">
        <div class="av-message-bubble__inner">
            <span v-if="!isOwn && senderName" class="av-message-bubble__sender">{{ senderName }}</span>
            <p class="av-message-bubble__text">{{ text }}</p>
            <time v-if="createdAt" class="av-message-bubble__time" :datetime="isoTime">{{ formattedTime }}</time>
        </div>
    </div>
</template>

<script setup lang="ts">
interface Props {
    text: string
    isOwn?: boolean
    senderName?: string
    createdAt?: Date | string
}

const props = withDefaults(defineProps<Props>(), {
    isOwn: false,
})

const isoTime = computed(() => {
    if (!props.createdAt) return ''
    const d = typeof props.createdAt === 'string' ? new Date(props.createdAt) : props.createdAt
    return d.toISOString()
})

const formattedTime = computed(() => {
    if (!props.createdAt) return ''
    const d = typeof props.createdAt === 'string' ? new Date(props.createdAt) : props.createdAt
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
})
</script>

<style scoped>
.av-message-bubble {
    display: flex;
    justify-content: flex-start;
    max-width: 75%;
}

.av-message-bubble--own {
    justify-content: flex-end;
    margin-left: auto;
}

.av-message-bubble__inner {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 14px;
    border-radius: 12px;
    background-color: var(--bg-secondary);
    max-width: 100%;
}

.av-message-bubble--own .av-message-bubble__inner {
    align-items: flex-end;
    background-color: var(--accent-color);
}

.av-message-bubble__sender {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent-color);
}

.av-message-bubble__text {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-color);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
}

.av-message-bubble__time {
    font-size: 11px;
    color: var(--text-secondary);
}

.av-message-bubble--own .av-message-bubble__time {
    color: rgba(255, 255, 255, 0.7);
}
</style>

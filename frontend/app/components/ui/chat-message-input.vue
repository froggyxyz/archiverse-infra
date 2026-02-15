<template>
    <div class="av-chat-input">
        <div class="av-chat-input__wrap">
            <textarea
                ref="textareaRef"
                v-model="vModel"
                class="av-chat-input__textarea"
                :placeholder="placeholder"
                :disabled="disabled"
                :maxlength="maxLength"
                rows="1"
                @keydown="onKeydown"
                @input="onInput"
            />
            <button
                type="button"
                class="av-chat-input__send"
                :disabled="!canSend"
                aria-label="Отправить"
                @click="send"
            >
                <Icon name="mdi:send" class="av-chat-input__send-icon" />
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
interface Props {
    placeholder?: string
    disabled?: boolean
    maxLength?: number
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: 'Сообщение…',
    disabled: false,
    maxLength: 65535,
})

const emit = defineEmits<{ send: [text: string] }>()

const vModel = defineModel<string>({ default: '' })
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const canSend = computed(() => vModel.value.trim().length > 0 && !props.disabled)

const send = () => {
    const text = vModel.value.trim()
    if (!text || props.disabled) return
    emit('send', text)
    vModel.value = ''
    resetHeight()
}

const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        send()
    }
}

const resetHeight = () => {
    const el = textareaRef.value
    if (el) {
        el.style.height = 'auto'
    }
}

const onInput = () => {
    const el = textareaRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

onMounted(() => {
    nextTick(onInput)
})
</script>

<style scoped>
.av-chat-input {
    width: 100%;
}

.av-chat-input__wrap {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 10px 10px 10px 15px;
    border-radius: 5px;
    border: 1px solid var(--bg-secondary);
    background-color: var(--bg-secondary);
}

.av-chat-input__textarea {
    flex: 1;
    min-height: 24px;
    max-height: 160px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-color);
    font-size: 16px;
    font-weight: 500;
    outline: none;
    resize: none;
    overflow-y: auto;
    font-family: inherit;
    padding: 10px 0;
}

.av-chat-input__textarea::placeholder {
    color: var(--text-secondary);
}

.av-chat-input__textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.av-chat-input__send {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 5px;
    border: none;
    background-color: var(--accent-color);
    color: var(--color-secondary);
    cursor: pointer;
    transition: opacity 0.2s;
}

.av-chat-input__send:hover:not(:disabled) {
    opacity: 0.9;
}

.av-chat-input__send:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.av-chat-input__send-icon {
    font-size: 20px;
}
</style>

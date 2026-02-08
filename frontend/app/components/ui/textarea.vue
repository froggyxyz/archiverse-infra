<template>
    <div class="av-textarea">
        <label class="av-textarea__label" :for="name">{{ label }} <span v-if="required">*</span></label>
        <div class="av-textarea__textarea-container">
            <textarea class="av-textarea__textarea" :id="name" :name :placeholder v-model="vModel" :maxlength="maxLength"></textarea>
            <span class="av-textarea__counter">{{ vModel.length }}/{{ maxLength }}</span>
        </div>
        <p class="av-textarea__error" v-if="error">{{ error }}</p>
    </div>
</template>

<script setup lang="ts">
interface Props {
    name: string;
    label?: string;
    placeholder?: string;
    required?: boolean;
    error?: string;
    maxLength?: number;
}

const props = withDefaults(defineProps<Props>(), {
    name: '',
    label: '',
    placeholder: '',
    required: false,
    error: '',
    maxLength: 1000,
});

const vModel = defineModel<string>({
    default: '',
});
</script>

<style scoped>
.av-textarea {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.av-textarea__label {
    font-size: 18px;
    font-weight: 500;
}

.av-textarea__textarea-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    position: relative;
}

.av-textarea__counter {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    position: absolute;
    right: 0;
    bottom: 0;
    padding: 5px 10px;
    background-color: var(--bg-secondary);
    border-radius: 5px;
}

.av-textarea__textarea {
    width: 100%;
    height: 200px;
    padding: 15px 10px 30px;
    border-radius: 5px;
    border: 1px solid var(--bg-secondary);
    background-color: var(--bg-secondary);
    color: var(--text-color);
    font-size: 18px;
    font-weight: 500;
    outline: none;
    resize: none;
}
</style>
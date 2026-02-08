<template>
    <div class="av-checkbox">
        <div :class="['av-checkbox__input-container', { 'av-checkbox__input-container--checked': vModel }]">
            <input class="av-checkbox__input" type="checkbox" :id="name" :name :value v-model="vModel" />
            <span class="av-checkbox__input-inner"></span>
        </div>
        <label class="av-checkbox__label" :for="name">{{ label }}</label>
    </div>
</template>

<script setup lang="ts">
interface Props {
    name: string;
    label?: string;
    value?: string;
    required?: boolean;
    error?: string;
}

const props = withDefaults(defineProps<Props>(), {
    name: '',
    label: '',
    value: '',
    required: false,
    error: '',
});

const vModel = defineModel<boolean>({
    default: false,
});
</script>

<style scoped>
.av-checkbox {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
}

.av-checkbox__input-container {
    width: 25px;
    height: 25px;
    border-radius: 3px;
    border: 1px solid var(--bg-secondary);
    background-color: var(--bg-secondary);
    position: relative;
    cursor: pointer;
}

.av-checkbox__input-container--checked {
    .av-checkbox__input-inner {
        box-shadow: 0 0 0 4px var(--accent-color) inset;
    }
}

.av-checkbox__input {
    width: 100%;
    height: 100%;
    opacity: 0;
    position: absolute;
    inset: 0;
    z-index: 2;
    cursor: pointer;
}

.av-checkbox__input-inner {
    border-radius: 3px;
    display: block;
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
    transition: box-shadow 0.3s ease-in-out;
}

.av-checkbox__label {
    font-size: 18px;
    font-weight: 500;
    cursor: pointer;
}
</style>
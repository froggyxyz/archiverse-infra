<template>
    <component :is="componentTag" :class="['av-btn', `av-btn--${width}`, `av-btn--${size}`]" :disabled="disabled">
        <span class="av-btn__content">
            <slot />
        </span>
    </component>
</template>

<script setup lang="ts">
interface Props {
    href?: String;
    width?: 'fit' | 'full';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    width: 'fit',
    size: 'md',
    disabled: false,
});

const componentTag = computed<string>(() => props.href ? 'a' : 'button');
</script>

<style scoped>
.av-btn {
    width: var(--btn-width);
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--btn-width);
    padding: var(--btn-padding);
    border-radius: 5px;
    border: none;
    background-color: var(--bg-secondary);
    cursor: pointer;

    .av-btn__content {
        width: fit-content;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--btn-gap);
        color: var(--text-color);
        font-size: var(--btn-font-size);
    }
}

.av-btn--fit {
    --btn-width: fit-content;
}

.av-btn--full {
    --btn-width: 100%;
}

.av-btn--sm {
    --btn-padding: 5px 10px;
    --btn-font-size: 14px;
    --btn-gap: 4px;
}

.av-btn--md {
    --btn-padding: 10px 20px;
    --btn-font-size: 16px;
    --btn-gap: 8px;
}

.av-btn--lg {
    --btn-padding: 15px 30px;
    --btn-font-size: 18px;
    --btn-gap: 10px;
}
</style>
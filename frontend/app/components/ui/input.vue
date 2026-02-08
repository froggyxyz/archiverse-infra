<template>
    <div class="av-input">
        <label class="av-input__label" :for="name">{{ label }} <span v-if="required">*</span></label>
        <div class="av-input__input-container">
            <input
                class="av-input__input"
                v-model="vModel"
                :id="name"
                :name
                :type="isShowPassword ? 'text' : type"
                :placeholder
            />
            <template v-if="type === 'password'">
                <button class="av-input__eye" @click="toggleIsShowPassword">
                    <Icon :name="isShowPassword ? 'mdi:eye-outline' : 'mdi:eye-off-outline'" class="av-input__eye-icon" />
                </button>
            </template>
        </div>
        <p class="av-input__generate" v-if="type === 'password'" @click="generatePassword">Сгенерировать</p>
        <p class="av-input__error" v-if="error">{{ error }}</p>
    </div>
</template>

<script setup lang="ts">
import { passwordGenerate } from '~/utils/password-generate';

interface Props {
    name: string;
    label?: string;
    placeholder?: string;
    type?: 'text' | 'email' | 'password';
    required?: boolean;
    error?: string;
}

const props = withDefaults(defineProps<Props>(), {
    name: '',
    label: '',
    placeholder: '',
    type: 'text',
    required: false,
    error: '',
});

const vModel = defineModel<string>({
    default: '',
});

const isShowPassword = ref<boolean>(false);
const toggleIsShowPassword = (): void => {
    isShowPassword.value = !isShowPassword.value;
};

const generatePassword = (): void => {
    vModel.value = passwordGenerate();
};
</script>

<style scoped>
.av-input {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.av-input__label {
    font-size: 18px;
    font-weight: 500;

    span {
        color: var(--accent-color);
    }
}

.av-input__input-container {
    width: 100%;
    display: flex;
    position: relative;

    .av-input__eye {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        cursor: pointer;

        .av-input__eye-icon {
            font-size: 24px;
            color: var(--text-color);
        }
    }
}

.av-input__input {
    width: 100%;
    padding: 15px 10px;
    border-radius: 5px;
    border: 1px solid var(--bg-secondary);
    background-color: var(--bg-secondary);
    color: var(--text-color);
    font-size: 18px;
    font-weight: 500;
    outline: none;
}

.av-input__generate {
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-align: right;
    width: fit-content;
    margin-left: auto;
}
</style>
<template>
  <div class="av-file-input">
    <label v-if="label" class="av-file-input__label">
      {{ label }}
      <span v-if="required">*</span>
    </label>
    <div
      class="av-file-input__zone"
      :class="{
        'av-file-input__zone--dragover': isDragOver,
        'av-file-input__zone--has-files': modelValue.length > 0,
      }"
      @dragover.prevent="onDragOver"
      @dragenter.prevent="onDragEnter"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
      @click="triggerSelect"
    >
      <input
        ref="inputRef"
        type="file"
        :accept="acceptString"
        multiple
        class="av-file-input__input"
        @change="onInputChange"
      >
      <div class="av-file-input__content">
        <Icon name="mdi:cloud-upload-outline" class="av-file-input__icon" />
        <p class="av-file-input__hint">
          {{ modelValue.length > 0 ? `Выбрано файлов: ${modelValue.length} (${formatSize(totalSize)})` : hint }}
        </p>
      </div>
    </div>
    <ul v-if="modelValue.length > 0" class="av-file-input__list">
      <li
        v-for="(file, index) in modelValue"
        :key="`${file.name}-${file.size}-${file.lastModified}-${index}`"
        class="av-file-input__item"
      >
        <div class="av-file-input__preview">
          <img
            v-if="isImage(file)"
            :src="getPreviewUrl(file)"
            :alt="file.name"
            class="av-file-input__preview-img"
          >
          <Icon
            v-else-if="isVideo(file)"
            name="mdi:movie-open-outline"
            class="av-file-input__preview-icon"
          />
          <Icon
            v-else
            name="mdi:music-note-outline"
            class="av-file-input__preview-icon"
          />
        </div>
        <div class="av-file-input__item-info">
          <span class="av-file-input__item-name">{{ file.name }}</span>
          <span class="av-file-input__item-size">{{ formatSize(file.size) }}</span>
        </div>
        <button
          type="button"
          class="av-file-input__remove"
          aria-label="Удалить"
          @click.stop="removeFile(index)"
        >
          <Icon name="mdi:close" class="av-file-input__remove-icon" />
        </button>
      </li>
    </ul>
    <p v-if="error" class="av-file-input__error">
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
const MAX_FILES = 10
const ACCEPT = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
}

const acceptString = Object.values(ACCEPT).flat().join(',')

const props = withDefaults(
  defineProps<{
    label?: string
    hint?: string
    required?: boolean
    error?: string
  }>(),
  {
    label: '',
    hint: 'Перетащите файлы сюда или нажмите для выбора',
    required: false,
    error: '',
  }
)

const modelValue = defineModel<File[]>({
  default: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [File[]]
  error: [string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const dragCounter = ref(0)
const previewUrls = new Map<File, string>()

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg'])

const totalSize = computed(() =>
  modelValue.value.reduce((sum, f) => sum + f.size, 0)
)

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`
}

const isImage = (file: File) => IMAGE_TYPES.has(file.type)
const isVideo = (file: File) => VIDEO_TYPES.has(file.type)

const getPreviewUrl = (file: File) => {
  if (!previewUrls.has(file)) {
    previewUrls.set(file, URL.createObjectURL(file))
  }
  return previewUrls.get(file)!
}

const removeFile = (index: number) => {
  const file = modelValue.value[index]
  const url = previewUrls.get(file)
  if (url) {
    URL.revokeObjectURL(url)
    previewUrls.delete(file)
  }
  const next = modelValue.value.filter((_, i) => i !== index)
  modelValue.value = next
  if (next.length === 0) emit('error', '')
}

onBeforeUnmount(() => {
  modelValue.value.forEach((file) => {
    const url = previewUrls.get(file)
    if (url) URL.revokeObjectURL(url)
  })
  previewUrls.clear()
})

const filterValidFiles = (files: FileList | File[]): File[] => {
  const allowed = new Set(Object.values(ACCEPT).flat())
  return Array.from(files).filter((f) => allowed.has(f.type))
}

const addFiles = (files: FileList | File[]) => {
  const valid = filterValidFiles(files)
  const total = files instanceof FileList ? files.length : files.length
  const invalidCount = total - valid.length
  if (invalidCount > 0) {
    emit('error', `Пропущено ${invalidCount} файл(ов): только аудио, видео и изображения`)
  } else {
    emit('error', '')
  }
  const combined = [...modelValue.value, ...valid].slice(0, MAX_FILES)
  if (combined.length > MAX_FILES) {
    emit('error', `Максимум ${MAX_FILES} файлов`)
  }
  modelValue.value = combined
}

const onInputChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files?.length) addFiles(files)
  target.value = ''
}

const onDragEnter = (e: DragEvent) => {
  e.preventDefault()
  dragCounter.value++
  isDragOver.value = true
}

const onDragOver = (e: DragEvent) => {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'copy'
}

const onDragLeave = (e: DragEvent) => {
  e.preventDefault()
  dragCounter.value--
  if (dragCounter.value === 0) isDragOver.value = false
}

const onDrop = (e: DragEvent) => {
  e.preventDefault()
  dragCounter.value = 0
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files?.length) addFiles(files)
}

const triggerSelect = () => {
  inputRef.value?.click()
}
</script>

<style scoped>
.av-file-input {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.av-file-input__label {
  font-size: 18px;
  font-weight: 500;
}

.av-file-input__label span {
  color: var(--accent-color);
}

.av-file-input__zone {
  width: 100%;
  min-height: 160px;
  padding: 24px;
  border-radius: 5px;
  border: 2px dashed var(--bg-secondary);
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
}

.av-file-input__zone:hover {
  border-color: var(--text-secondary);
}

.av-file-input__zone--dragover {
  border-color: var(--accent-color);
  background-color: rgba(197, 33, 197, 0.08);
  box-shadow: 0 0 0 4px rgba(197, 33, 197, 0.2);
}

.av-file-input__zone--has-files {
  border-style: solid;
  border-color: var(--accent-color);
}

.av-file-input__input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.av-file-input__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.av-file-input__icon {
  font-size: 48px;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.av-file-input__zone--dragover .av-file-input__icon {
  color: var(--accent-color);
}

.av-file-input__hint {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-color);
}

.av-file-input__list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.av-file-input__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 5px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--bg-secondary);
  max-width: 100%;
}

.av-file-input__preview {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.av-file-input__preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.av-file-input__preview-icon {
  font-size: 24px;
  color: var(--text-secondary);
}

.av-file-input__item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.av-file-input__item-name {
  font-size: 14px;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.av-file-input__item-size {
  font-size: 12px;
  color: var(--text-secondary);
}

.av-file-input__remove {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.2s, background-color 0.2s;
}

.av-file-input__remove:hover {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.15);
}

.av-file-input__remove-icon {
  font-size: 20px;
}

.av-file-input__error {
  font-size: 14px;
  color: #ef4444;
}
</style>

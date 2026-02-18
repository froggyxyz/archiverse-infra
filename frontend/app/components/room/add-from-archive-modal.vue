<script setup lang="ts">
interface Props {
  modelValue: boolean
  /** IDs уже в плейлисте — не показывать */
  excludeMediaIds?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  excludeMediaIds: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  add: [mediaIds: string[]]
}>()

const { fetchArchive, archiveList } = useArchive()
const selectedIds = ref<Set<string>>(new Set())

const availableVideos = computed(() =>
  (archiveList.value?.items ?? []).filter(
    (m) => m.type === 'VIDEO' && m.status === 'COMPLETED' && !props.excludeMediaIds.includes(m.id)
  )
)

const toggleSelect = (id: string) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

const isSelected = (id: string) => selectedIds.value.has(id)

const onConfirm = () => {
  if (selectedIds.value.size === 0) return
  emit('add', Array.from(selectedIds.value))
  selectedIds.value = new Set()
  emit('update:modelValue', false)
}

const onClose = () => {
  selectedIds.value = new Set()
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (open) => {
  if (open) void fetchArchive(1, 100)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="room-add-modal"
        @click.self="onClose"
      >
        <div class="room-add-modal__box">
          <div class="room-add-modal__header">
            <h2 class="room-add-modal__title">
              Добавить из архива
            </h2>
            <button
              type="button"
              class="room-add-modal__close"
              aria-label="Закрыть"
              @click="onClose"
            >
              <Icon name="mdi:close" />
            </button>
          </div>
          <p v-if="availableVideos.length === 0" class="room-add-modal__empty">
            Нет доступных видео в архиве
          </p>
          <ul v-else class="room-add-modal__list">
            <li
              v-for="item in availableVideos"
              :key="item.id"
              class="room-add-modal__item"
              :class="{ 'room-add-modal__item--selected': isSelected(item.id) }"
              @click="toggleSelect(item.id)"
            >
              <div class="room-add-modal__thumb">
                <img
                  v-if="item.thumbnailUrl"
                  :src="item.thumbnailUrl"
                  :alt="item.filename"
                >
                <Icon v-else name="mdi:movie-open-outline" class="room-add-modal__thumb-icon" />
              </div>
              <span class="room-add-modal__name">{{ item.filename }}</span>
              <div v-if="isSelected(item.id)" class="room-add-modal__check">
                <Icon name="mdi:check-circle" />
              </div>
            </li>
          </ul>
          <div class="room-add-modal__footer">
            <UiButton size="sm" @click="onClose">
              Отмена
            </UiButton>
            <UiButton
              size="sm"
              :disabled="selectedIds.size === 0"
              @click="onConfirm"
            >
              Добавить ({{ selectedIds.size }})
            </UiButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.room-add-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
}

.room-add-modal__box {
  width: 90%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
  border-radius: 12px;
  border: 1px solid var(--bg-secondary);
  overflow: hidden;
}

.room-add-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--bg-secondary);
}

.room-add-modal__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
}

.room-add-modal__close {
  padding: 6px;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
}

.room-add-modal__close:hover {
  color: var(--text-color);
}

.room-add-modal__empty {
  padding: 32px;
  text-align: center;
  color: var(--text-secondary);
}

.room-add-modal__list {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-add-modal__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s, background 0.15s;
}

.room-add-modal__item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.room-add-modal__item--selected {
  border-color: var(--accent-color);
}

.room-add-modal__thumb {
  flex-shrink: 0;
  width: 64px;
  height: 36px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.room-add-modal__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.room-add-modal__thumb-icon {
  font-size: 24px;
  color: var(--text-secondary);
}

.room-add-modal__name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-add-modal__check {
  flex-shrink: 0;
  color: var(--accent-color);
  font-size: 22px;
}

.room-add-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--bg-secondary);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

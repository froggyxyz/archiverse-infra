<script setup lang="ts">
import { VueDraggableNext } from 'vue-draggable-next'
import type { RoomPlaylistItem } from '~/types/room'

interface Props {
  items?: RoomPlaylistItem[]
  /** mediaId для подсветки текущего видео */
  currentMediaId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
})

const emit = defineEmits<{
  add: []
  remove: [itemId: string]
  reorder: [itemIds: string[]]
  select: [item: RoomPlaylistItem]
}>()

const sortedItems = ref<RoomPlaylistItem[]>([])

watch(
  () => props.items,
  (val) => {
    sortedItems.value = val?.length ? [...val] : []
  },
  { immediate: true, deep: true }
)

const onDragEnd = () => {
  emit('reorder', sortedItems.value.map((i) => i.id))
}

const onAddClick = () => emit('add')

const onRemove = (item: RoomPlaylistItem, e: Event) => {
  e.stopPropagation()
  emit('remove', item.id)
}

const onItemClick = (item: RoomPlaylistItem) => emit('select', item)
</script>

<template>
  <section class="room-playlist">
    <div class="room-playlist__header">
      <h2 class="room-playlist__title">
        Плейлист
      </h2>
      <UiButton size="sm" class="room-playlist__add-btn" @click="onAddClick">
        <Icon name="mdi:plus" class="room-playlist__add-icon" />
        Добавить из архива
      </UiButton>
    </div>

    <VueDraggableNext
      v-if="sortedItems.length > 0"
      v-model="sortedItems"
      tag="ul"
      class="room-playlist__list"
      handle=".room-playlist__drag"
      item-key="id"
      @end="onDragEnd"
    >
      <li
        v-for="(item, index) in sortedItems"
        :key="item.id"
        class="room-playlist__item"
        :class="{ 'room-playlist__item--active': currentMediaId && item.mediaId === currentMediaId }"
        @click="onItemClick(item)"
      >
        <button
          type="button"
          class="room-playlist__drag"
          aria-label="Перетащить"
          @click.stop
        >
          <Icon name="mdi:drag" class="room-playlist__drag-icon" />
        </button>
        <span class="room-playlist__index">{{ index + 1 }}</span>
        <div class="room-playlist__thumb-wrap">
          <img
            v-if="item.thumbnailUrl"
            :src="item.thumbnailUrl"
            :alt="item.title"
            class="room-playlist__thumb"
          >
          <div v-else class="room-playlist__thumb-placeholder">
            <Icon name="mdi:movie-open-outline" class="room-playlist__thumb-icon" />
          </div>
        </div>
        <div class="room-playlist__info">
          <span class="room-playlist__title-item">{{ item.title }}</span>
          <span class="room-playlist__duration">{{ item.duration }}</span>
        </div>
        <button
          type="button"
          class="room-playlist__remove"
          aria-label="Удалить из плейлиста"
          @click="onRemove(item, $event)"
        >
          <Icon name="mdi:close" class="room-playlist__remove-icon" />
        </button>
      </li>
    </VueDraggableNext>

    <div v-else class="room-playlist__empty">
      <Icon name="mdi:playlist-music-outline" class="room-playlist__empty-icon" />
      <p class="room-playlist__empty-text">Плейлист пуст</p>
      <p class="room-playlist__empty-hint">Добавьте видео из архива</p>
      <UiButton size="sm" @click="onAddClick">
        <Icon name="mdi:plus" />
        Добавить из архива
      </UiButton>
    </div>
  </section>
</template>

<style scoped>
.room-playlist {
  background-color: var(--bg-secondary);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--bg-secondary);
}

.room-playlist__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.room-playlist__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
}

.room-playlist__add-btn {
  flex-shrink: 0;
}

.room-playlist__add-icon {
  margin-right: 6px;
  font-size: 18px;
  vertical-align: middle;
}

.room-playlist__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-playlist__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background-color: var(--bg-color);
  border-radius: 8px;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
  cursor: pointer;
}

.room-playlist__item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.room-playlist__item--active {
  border-color: var(--accent-color);
}

.room-playlist__drag {
  flex-shrink: 0;
  padding: 4px;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: grab;
  border-radius: 4px;
}

.room-playlist__drag:hover {
  color: var(--text-color);
}

.room-playlist__drag:active {
  cursor: grabbing;
}

.room-playlist__drag-icon {
  font-size: 20px;
}

.room-playlist__index {
  flex-shrink: 0;
  width: 24px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  text-align: center;
}

.room-playlist__thumb-wrap {
  flex-shrink: 0;
  width: 80px;
  height: 45px;
  border-radius: 6px;
  overflow: hidden;
  background-color: var(--color-primary);
}

.room-playlist__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.room-playlist__thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.room-playlist__thumb-icon {
  font-size: 24px;
  color: var(--text-secondary);
}

.room-playlist__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.room-playlist__title-item {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-playlist__duration {
  font-size: 12px;
  color: var(--text-secondary);
}

.room-playlist__remove {
  flex-shrink: 0;
  padding: 6px;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
}

.room-playlist__remove:hover {
  color: var(--text-color);
  background: rgba(255, 255, 255, 0.08);
}

.room-playlist__remove-icon {
  font-size: 20px;
}

.room-playlist__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 24px;
  text-align: center;
}

.room-playlist__empty-icon {
  font-size: 48px;
  color: var(--text-secondary);
  opacity: 0.5;
}

.room-playlist__empty-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-color);
}

.room-playlist__empty-hint {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
</style>

<script setup lang="ts">
import type { RoomPlaylistItem } from '~/types/room'

interface Props {
  items?: RoomPlaylistItem[]
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
})
</script>

<template>
  <section class="room-playlist">
    <div class="room-playlist__header">
      <h2 class="room-playlist__title">
        Плейлист
      </h2>
      <UiButton size="sm" class="room-playlist__add-btn">
        <Icon name="mdi:plus" class="room-playlist__add-icon" />
        Добавить из архива
      </UiButton>
    </div>

    <ul v-if="props.items.length > 0" class="room-playlist__list">
      <li
        v-for="(item, index) in props.items"
        :key="item.id"
        class="room-playlist__item"
      >
        <button
          type="button"
          class="room-playlist__drag"
          aria-label="Перетащить"
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
        >
          <Icon name="mdi:close" class="room-playlist__remove-icon" />
        </button>
      </li>
    </ul>

    <div v-else class="room-playlist__empty">
      <Icon name="mdi:playlist-music-outline" class="room-playlist__empty-icon" />
      <p class="room-playlist__empty-text">Плейлист пуст</p>
      <p class="room-playlist__empty-hint">Добавьте видео из архива</p>
      <UiButton size="sm">
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
}

.room-playlist__item:hover {
  background: rgba(255, 255, 255, 0.04);
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

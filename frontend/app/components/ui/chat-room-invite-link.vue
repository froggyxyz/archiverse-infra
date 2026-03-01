<template>
  <NuxtLink
    :to="`/rooms/join/${encodeURIComponent(inviteCode)}`"
    target="_blank"
    rel="noopener noreferrer"
    class="chat-room-invite-link"
  >
    <div class="chat-room-invite-link__preview">
      <img
        v-if="preview?.thumbnailUrl"
        :src="preview.thumbnailUrl"
        alt=""
        class="chat-room-invite-link__img"
      >
      <div
        v-else
        class="chat-room-invite-link__placeholder"
        aria-hidden="true"
      />
    </div>
    <span class="chat-room-invite-link__label">
      {{ label }}
    </span>
  </NuxtLink>
</template>

<script setup lang="ts">
const props = defineProps<{
  inviteCode: string
}>()

const api = useApiEndpoints()

const { data: preview } = useAsyncData(
  `room-invite-preview-${props.inviteCode}`,
  async () => {
    try {
      return await api.rooms.getRoomInvitePreview(props.inviteCode)
    } catch {
      return null
    }
  },
  { watch: [() => props.inviteCode] }
)

const label = computed(() => {
  const name = preview.value?.creatorUsername
  return name
    ? `Присоединиться к комнате ${name}`
    : 'Присоединиться к комнате'
})
</script>

<style scoped>
.chat-room-invite-link {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  max-width: 200px;
  margin: 4px 0;
  padding: 6px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  text-decoration: none;
  color: inherit;
  transition: background 0.2s;
  vertical-align: top;
}

.chat-room-invite-link:hover {
  background: rgba(0, 0, 0, 0.35);
}

.chat-room-invite-link__preview {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  overflow: hidden;
  background: #0a0a0a;
}

.chat-room-invite-link__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-room-invite-link__placeholder {
  width: 100%;
  height: 100%;
  background: #0a0a0a;
}

.chat-room-invite-link__label {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--accent-color);
}
</style>

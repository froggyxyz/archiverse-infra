<script setup lang="ts">
definePageMeta({
  auth: true,
})

const route = useRoute()
const code = computed(() => route.params.code as string)

const api = useApiEndpoints()
const { addError } = useAlerts()

const isLoading = ref(true)

onMounted(async () => {
  if (!code.value) {
    await navigateTo('/')
    return
  }

  try {
    const result = await api.rooms.joinByInviteCode(code.value)
    await navigateTo(`/rooms/${result.roomId}`)
  } catch {
    addError('Комната не найдена')
    await navigateTo('/')
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="join-page">
    <p v-if="isLoading">Присоединение к комнате…</p>
  </div>
</template>

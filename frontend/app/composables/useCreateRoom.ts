export const useCreateRoom = () => {
  const api = useApiEndpoints()
  const { addError } = useAlerts()

  const createAndGo = async () => {
    try {
      const room = await api.rooms.create()
      await navigateTo(`/rooms/${room.id}`)
    } catch (e) {
      addError((e as Error)?.message ?? 'Не удалось создать комнату')
    }
  }

  return { createAndGo }
}

export default defineNuxtPlugin(() => {
  const { restoreFromStorage } = useAuthTokens()
  restoreFromStorage()
})

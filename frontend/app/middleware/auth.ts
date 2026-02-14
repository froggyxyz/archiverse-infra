import { AUTH_ROUTES } from '~/lib/auth/constants'

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const authRequired = to.meta.auth === true
  const authOptional = to.meta.auth === 'optional'

  if (!authRequired && !authOptional) return

  const { hasValidAccessToken, user, restoreFromStorage } = useAuthTokens()
  restoreFromStorage()

  const isAuthenticated = hasValidAccessToken.value || Boolean(user.value)

  if (authRequired && !isAuthenticated) {
    return navigateTo({
      path: AUTH_ROUTES.LOGIN,
      query: { redirect: to.fullPath },
    })
  }

  if (to.path === AUTH_ROUTES.LOGIN && isAuthenticated) {
    const redirect = (to.query.redirect as string) ?? AUTH_ROUTES.HOME
    return navigateTo(redirect)
  }
})

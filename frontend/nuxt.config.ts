// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:3001',
    },
  },

  router: {
    middleware: ['auth'],
  },

  modules: [
    '@nuxt/fonts',
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxt/image',
  ],

  fonts: {
    families: [
      { name: 'Roboto Mono', provider: 'google', weights: [100, 400, 500, 600, 700] },
    ],
  },
})
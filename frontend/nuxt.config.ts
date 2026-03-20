// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Полифилл Object.hasOwn для Safari < 15.4 (iPhone 7 Plus и др.) — используется devalue при парсинге Nuxt payload
  app: {
    head: {
      script: [
        {
          tagPosition: 'head',
          innerHTML: "if (typeof Object.hasOwn !== 'function') { Object.defineProperty(Object, 'hasOwn', { value: function (obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); }, writable: true, configurable: true }); }",
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:3001',
    },
  },

  router: {
    middleware: ['auth'],
  },

  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },

  build: {
    transpile: ['vue-draggable-next'],
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
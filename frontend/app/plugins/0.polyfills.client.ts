/**
 * Полифилл Object.hasOwn для Safari < 15.4 (iPhone 7 Plus и др.).
 * Nuxt использует devalue для парсинга payload при гидрации — без полифилла инициализация падает.
 */
function applyObjectHasOwnPolyfill() {
  if (typeof Object.hasOwn === 'function') return
  Object.defineProperty(Object, 'hasOwn', {
    value(obj: object, prop: string | number | symbol) {
      return Object.prototype.hasOwnProperty.call(obj, prop)
    },
    writable: true,
    configurable: true,
  })
}

applyObjectHasOwnPolyfill()

export default defineNuxtPlugin({
  name: 'polyfills',
  enforce: 'pre',
  setup: () => {},
})

import { ALERT_DEFAULT_DURATION, ALERT_TYPES, type AddAlertOptions, type AlertItem, type AlertType } from '~/types/alert'

const ALERTS_INJECT_KEY = Symbol('alerts') as import('vue').InjectionKey<{
  alerts: Ref<AlertItem[]>
  add: (type: AlertType, message: string, options?: AddAlertOptions) => string
  addSuccess: (message: string, options?: AddAlertOptions) => string
  addError: (message: string, options?: AddAlertOptions) => string
  addInfo: (message: string, options?: AddAlertOptions) => string
  remove: (id: string) => void
  clear: () => void
}>

let idCounter = 0

const generateId = () => `alert-${++idCounter}-${Date.now()}`

export const useAlerts = () => {
  const context = inject(ALERTS_INJECT_KEY)
  if (!context) {
    throw new Error('useAlerts должен использоваться внутри AlertsProvider')
  }
  return context
}

export const provideAlerts = () => {
  const alerts = useState<AlertItem[]>('alerts', () => [])
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>()

  const remove = (id: string) => {
    const timeout = timeouts.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeouts.delete(id)
    }
    alerts.value = alerts.value.filter((a) => a.id !== id)
  }

  const add = (type: AlertType, message: string, options?: AddAlertOptions): string => {
    const id = generateId()
    alerts.value = [...alerts.value, { id, type, message }]

    const duration = options?.duration !== undefined ? options.duration : ALERT_DEFAULT_DURATION
    if (duration > 0) {
      const timeout = setTimeout(() => {
        remove(id)
        timeouts.delete(id)
      }, duration)
      timeouts.set(id, timeout)
    }

    return id
  }

  const addSuccess = (message: string, options?: AddAlertOptions) =>
    add(ALERT_TYPES.SUCCESS, message, options)

  const addError = (message: string, options?: AddAlertOptions) =>
    add(ALERT_TYPES.ERROR, message, options)

  const addInfo = (message: string, options?: AddAlertOptions) =>
    add(ALERT_TYPES.INFO, message, options)

  const clear = () => {
    timeouts.forEach((t) => clearTimeout(t))
    timeouts.clear()
    alerts.value = []
  }

  const api = { alerts, add, addSuccess, addError, addInfo, remove, clear }
  provide(ALERTS_INJECT_KEY, api)
  return api
}

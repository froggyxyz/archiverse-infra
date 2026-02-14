export const ALERT_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
} as const

export type AlertType = (typeof ALERT_TYPES)[keyof typeof ALERT_TYPES]

export type AlertItem = {
  id: string
  type: AlertType
  message: string
}

export type AddAlertOptions = {
  /** Длительность показа в мс. По умолчанию 5000. Укажите 0 для отключения автоскрытия */
  duration?: number
}

export const ALERT_DEFAULT_DURATION = 5000

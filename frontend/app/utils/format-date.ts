/** Форматирует дату для списка чатов. Использует локальную временную зону пользователя. */
export const formatChatListDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  if (sameDay) {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    }).format(d)
  }

  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  if (d > weekAgo) {
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'short',
      timeZone: tz,
    }).format(d)
  }

  const sameYear = d.getFullYear() === now.getFullYear()
  if (sameYear) {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      timeZone: tz,
    }).format(d)
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: tz,
  }).format(d)
}

/** Форматирует время сообщения (ЧЧ:ММ). Локальная временная зона. */
export const formatMessageTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(d)
}

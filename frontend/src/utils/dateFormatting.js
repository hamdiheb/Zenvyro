const MINUTE_MILLISECONDS = 60_000
const HOUR_MILLISECONDS = 60 * MINUTE_MILLISECONDS
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS

export function formatRelativeTime(timestamp, currentTime = Date.now()) {
  const elapsedMilliseconds = currentTime - new Date(timestamp).getTime()
  if (elapsedMilliseconds < MINUTE_MILLISECONDS) {
    return 'now'
  }
  if (elapsedMilliseconds < HOUR_MILLISECONDS) {
    return `${Math.floor(elapsedMilliseconds / MINUTE_MILLISECONDS)}m ago`
  }
  if (elapsedMilliseconds < DAY_MILLISECONDS) {
    return `${Math.floor(elapsedMilliseconds / HOUR_MILLISECONDS)}h ago`
  }
  if (elapsedMilliseconds < 7 * DAY_MILLISECONDS) {
    return new Date(timestamp).toLocaleDateString('en', { weekday: 'short' })
  }
  return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export function formatFullDateTime(timestamp) {
  return new Date(timestamp).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatMessageTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
}

// "Today", "Yesterday", or "Monday, 5 February" for the day separators.
export function formatDayLabel(timestamp, currentTime = Date.now()) {
  const messageDate = new Date(timestamp)
  const todayStart = new Date(currentTime)
  todayStart.setHours(0, 0, 0, 0)
  const messageDayStart = new Date(messageDate)
  messageDayStart.setHours(0, 0, 0, 0)
  const dayDifference = Math.round((todayStart - messageDayStart) / DAY_MILLISECONDS)
  if (dayDifference === 0) {
    return 'Today'
  }
  if (dayDifference === 1) {
    return 'Yesterday'
  }
  return messageDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function readDayKey(timestamp) {
  const messageDate = new Date(timestamp)
  return `${messageDate.getFullYear()}-${messageDate.getMonth()}-${messageDate.getDate()}`
}

// Splits a chronological message list into [{ dayKey, dayLabel, messages }] groups.
export function groupMessagesByDay(messages) {
  const dayGroups = []
  messages.forEach((message) => {
    const dayKey = readDayKey(message.createdAt)
    const lastGroup = dayGroups[dayGroups.length - 1]
    if (lastGroup && lastGroup.dayKey === dayKey) {
      lastGroup.messages.push(message)
    } else {
      dayGroups.push({ dayKey, dayLabel: formatDayLabel(message.createdAt), messages: [message] })
    }
  })
  return dayGroups
}

export function readGreeting(currentTime = new Date()) {
  const currentHour = currentTime.getHours()
  if (currentHour < 12) {
    return 'Good morning'
  }
  if (currentHour < 18) {
    return 'Good afternoon'
  }
  return 'Good evening'
}

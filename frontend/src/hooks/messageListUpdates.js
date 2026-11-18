// Adds messages to a chronological list, skipping ids already present. A message can arrive twice:
// once from the POST response and once from the realtime event.
export function mergeMessagesById(currentMessages, incomingMessages) {
  const knownIds = new Set(currentMessages.map((message) => message.id))
  const newMessages = incomingMessages.filter((message) => !knownIds.has(message.id))
  if (newMessages.length === 0) {
    return currentMessages
  }
  return [...currentMessages, ...newMessages].sort(
    (firstMessage, secondMessage) => new Date(firstMessage.createdAt) - new Date(secondMessage.createdAt),
  )
}

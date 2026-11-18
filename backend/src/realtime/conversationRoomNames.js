// One Socket.IO room per conversation. Only sockets that passed the business check join it.
export function buildConversationRoomName(conversationId) {
  return `conversation:${conversationId}`
}

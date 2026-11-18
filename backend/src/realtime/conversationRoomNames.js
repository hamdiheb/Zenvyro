// One Socket.IO room per conversation. Only sockets that passed the business check join it.
export function buildConversationRoomName(conversationId) {
  return `conversation:${conversationId}`
}

// One room per business. Every signed-in staff socket of that business joins it, so the inbox list
// hears about new and changed conversations. Website visitors never join it.
export function buildBusinessRoomName(businessId) {
  return `business:${businessId}`
}

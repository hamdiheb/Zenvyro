import { buildConversationRoomName } from './conversationRoomNames.js'
import { MESSAGE_CREATED_EVENT } from './realtimeEventNames.js'

// Sends a saved message to every socket that joined the conversation's room.
// Call it only after the message is committed, so clients never see a message that was rolled back.
export function publishMessageCreatedToConversation(socketServer, { conversationId, message }) {
  if (!socketServer) {
    return
  }
  socketServer
    .to(buildConversationRoomName(conversationId))
    .emit(MESSAGE_CREATED_EVENT, { conversationId, message })
}

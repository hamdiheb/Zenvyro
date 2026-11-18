import { buildConversationRoomName, buildBusinessRoomName } from './conversationRoomNames.js'
import {
  MESSAGE_CREATED_EVENT,
  CONVERSATION_CREATED_EVENT,
  CONVERSATION_UPDATED_EVENT,
} from './realtimeEventNames.js'

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

// Tells the business's staff that a conversation now exists. Call it after the commit.
export function publishConversationCreatedToBusiness(socketServer, { businessId, conversation }) {
  if (!socketServer) {
    return
  }
  socketServer.to(buildBusinessRoomName(businessId)).emit(CONVERSATION_CREATED_EVENT, { conversation })
}

// Sends the conversation's current state (status, assignee, labels, lastMessageAt) to the business's staff.
// Call it after the commit, so the inbox list re-reads the same row the database now holds.
export function publishConversationUpdatedToBusiness(socketServer, { businessId, conversation }) {
  if (!socketServer) {
    return
  }
  socketServer.to(buildBusinessRoomName(businessId)).emit(CONVERSATION_UPDATED_EVENT, { conversation })
}

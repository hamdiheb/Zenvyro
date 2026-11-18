// Event names shared by the gateway and the code that publishes realtime events.
// Clients send join and leave requests. The server sends message:created to a conversation's room.
export const CONVERSATION_JOIN_EVENT = 'conversation:join'
export const CONVERSATION_LEAVE_EVENT = 'conversation:leave'
export const MESSAGE_CREATED_EVENT = 'message:created'

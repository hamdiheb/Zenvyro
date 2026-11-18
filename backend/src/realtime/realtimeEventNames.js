// Event names shared by the gateway and the code that publishes realtime events.
// Clients send join and leave requests. The server sends message:created to a conversation's room,
// and conversation:created / conversation:updated to a business's room (staff only).
export const CONVERSATION_JOIN_EVENT = 'conversation:join'
export const CONVERSATION_LEAVE_EVENT = 'conversation:leave'
export const MESSAGE_CREATED_EVENT = 'message:created'
export const CONVERSATION_CREATED_EVENT = 'conversation:created'
export const CONVERSATION_UPDATED_EVENT = 'conversation:updated'

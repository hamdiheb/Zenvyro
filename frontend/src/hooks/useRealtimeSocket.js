import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import {
  CONVERSATION_JOIN_EVENT,
  CONVERSATION_LEAVE_EVENT,
  MESSAGE_CREATED_EVENT,
} from './realtimeEventNames.js'

// One shared staff socket for the whole app. It authenticates with the same HttpOnly cookie as REST,
// which works because Vite proxies /socket.io on the same origin. It is created on first use and
// closed on sign-out, so a new session's cookie is used on the next connect.
let sharedStaffSocket = null

function getStaffSocket() {
  if (!sharedStaffSocket) {
    sharedStaffSocket = io({ withCredentials: true })
  }
  return sharedStaffSocket
}

export function disconnectStaffSocket() {
  if (sharedStaffSocket) {
    sharedStaffSocket.disconnect()
    sharedStaffSocket = null
  }
}

export function useRealtimeSocket() {
  const [staffSocket] = useState(getStaffSocket)
  return staffSocket
}

// Joins the open conversation's room (and leaves it on change). Re-joins after a reconnect,
// because the server forgets room membership when a socket drops.
export function useConversationRoom(realtimeSocket, conversationId) {
  useEffect(() => {
    if (!realtimeSocket || !conversationId) {
      return undefined
    }
    const joinRoom = () => realtimeSocket.emit(CONVERSATION_JOIN_EVENT, { conversationId })
    joinRoom()
    realtimeSocket.on('connect', joinRoom)
    return () => {
      realtimeSocket.off('connect', joinRoom)
      realtimeSocket.emit(CONVERSATION_LEAVE_EVENT, { conversationId })
    }
  }, [realtimeSocket, conversationId])
}

// Calls onMessageCreated({ conversationId, message }) for every message:created event.
// The latest callback is kept in a ref so the listener is attached only once per socket.
export function useMessageCreatedListener(realtimeSocket, onMessageCreated) {
  const callbackReference = useRef(onMessageCreated)

  useEffect(() => {
    callbackReference.current = onMessageCreated
  })

  useEffect(() => {
    if (!realtimeSocket) {
      return undefined
    }
    const handleMessageCreated = (realtimeEvent) => callbackReference.current(realtimeEvent)
    realtimeSocket.on(MESSAGE_CREATED_EVENT, handleMessageCreated)
    return () => realtimeSocket.off(MESSAGE_CREATED_EVENT, handleMessageCreated)
  }, [realtimeSocket])
}

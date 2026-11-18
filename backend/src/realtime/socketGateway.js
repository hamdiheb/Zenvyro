import { Server as SocketIoServer } from 'socket.io'
import cookieParser from 'cookie-parser'
import { environmentConfig } from '../config/environmentConfig.js'
import { pool } from '../db/databasePool.js'
import { findLiveSessionByTokenHash } from '../repositories/sessionsRepository.js'
import { findConversationForBusiness } from '../repositories/conversationsRepository.js'
import { hashSessionToken } from '../services/sessionTokenService.js'
import { findLiveWidgetSessionForToken } from '../services/widgetSessionService.js'
import { isValidUuid } from '../utils/inputValidation.js'
import {
  CONVERSATION_JOIN_EVENT,
  CONVERSATION_LEAVE_EVENT,
} from './realtimeEventNames.js'
import { buildConversationRoomName, buildBusinessRoomName } from './conversationRoomNames.js'

const NOT_SIGNED_IN_MESSAGE = 'You must be signed in.'
const SESSION_ENDED_MESSAGE = 'Your session has ended. Please sign in again.'
const SESSION_CHECK_FAILED_MESSAGE = 'Could not verify your session.'
const WIDGET_SESSION_ENDED_MESSAGE = 'Your chat session has ended. Start a new chat.'
const CONVERSATION_NOT_FOUND_MESSAGE = 'Conversation not found.'
const JOIN_FAILED_MESSAGE = 'Could not join the conversation.'

// Acknowledgements are optional: a client may send an event without a callback.
function acknowledgeRequest(acknowledgeCallback, result) {
  if (typeof acknowledgeCallback === 'function') {
    acknowledgeCallback(result)
  }
}

// Joins the room only when the conversation belongs to the socket's business.
// A conversation from another business gets the same "not found" answer as a missing one.
async function joinConversationRoom(socket, joinRequest, acknowledgeCallback) {
  try {
    // Visitors are placed in their own room on connect and may not join others, so they get the
    // same "not found" answer as any other conversation they cannot see.
    const conversationId = joinRequest?.conversationId
    if (!socket.data.authenticatedUser || !isValidUuid(conversationId)) {
      return acknowledgeRequest(acknowledgeCallback, { isSuccessful: false, error: CONVERSATION_NOT_FOUND_MESSAGE })
    }

    const conversationRow = await findConversationForBusiness(pool, {
      businessId: socket.data.authenticatedUser.businessId,
      conversationId,
    })
    if (!conversationRow) {
      return acknowledgeRequest(acknowledgeCallback, { isSuccessful: false, error: CONVERSATION_NOT_FOUND_MESSAGE })
    }

    await socket.join(buildConversationRoomName(conversationId))
    return acknowledgeRequest(acknowledgeCallback, { isSuccessful: true, conversationId })
  } catch (error) {
    console.error('Joining conversation room failed:', error)
    return acknowledgeRequest(acknowledgeCallback, { isSuccessful: false, error: JOIN_FAILED_MESSAGE })
  }
}

async function leaveConversationRoom(socket, leaveRequest, acknowledgeCallback) {
  const conversationId = leaveRequest?.conversationId
  if (!isValidUuid(conversationId)) {
    return acknowledgeRequest(acknowledgeCallback, { isSuccessful: false, error: CONVERSATION_NOT_FOUND_MESSAGE })
  }

  await socket.leave(buildConversationRoomName(conversationId))
  return acknowledgeRequest(acknowledgeCallback, { isSuccessful: true, conversationId })
}

// The browser sends the same HttpOnly session cookie that the REST API uses, so the socket
// is checked against the sessions table exactly like a REST request.
async function authenticateSocketConnection(socket, nextFunction) {
  try {
    const sessionToken = socket.request.cookies?.[environmentConfig.sessionCookieName]
    if (!sessionToken) {
      return authenticateWidgetVisitor(socket, nextFunction)
    }

    const sessionRow = await findLiveSessionByTokenHash(pool, hashSessionToken(sessionToken))
    if (!sessionRow) {
      return nextFunction(new Error(SESSION_ENDED_MESSAGE))
    }

    socket.data.authenticatedUser = {
      id: sessionRow.id,
      businessId: sessionRow.business_id,
      name: sessionRow.name,
      email: sessionRow.email,
      role: sessionRow.role,
    }
    return nextFunction()
  } catch (error) {
    console.error('Socket session check failed:', error)
    return nextFunction(new Error(SESSION_CHECK_FAILED_MESSAGE))
  }
}

// Website visitors have no staff cookie. They send their widget session token in the handshake auth
// object (socket.io-client: io(url, { auth: { widgetSessionToken } })).
async function authenticateWidgetVisitor(socket, nextFunction) {
  const widgetSessionToken = socket.handshake.auth?.widgetSessionToken
  if (typeof widgetSessionToken !== 'string' || widgetSessionToken.length === 0) {
    return nextFunction(new Error(NOT_SIGNED_IN_MESSAGE))
  }

  const widgetSession = await findLiveWidgetSessionForToken(widgetSessionToken)
  if (!widgetSession) {
    return nextFunction(new Error(WIDGET_SESSION_ENDED_MESSAGE))
  }

  socket.data.widgetSession = widgetSession
  return nextFunction()
}

// Attaches Socket.IO to the HTTP server. Only signed-in staff sessions can connect.
export function createSocketGateway(httpServer) {
  const socketServer = new SocketIoServer(httpServer, {
    cors: {
      origin: environmentConfig.corsAllowedOrigins,
      credentials: true,
    },
  })

  // Parses the Cookie header for the engine handshake request, so socket.request.cookies exists.
  socketServer.engine.use(cookieParser())
  socketServer.use(authenticateSocketConnection)

  socketServer.on('connection', (socket) => {
    if (socket.data.widgetSession) {
      socket.join(buildConversationRoomName(socket.data.widgetSession.conversation_id))
    }
    if (socket.data.authenticatedUser) {
      socket.join(buildBusinessRoomName(socket.data.authenticatedUser.businessId))
    }
    socket.on(CONVERSATION_JOIN_EVENT, (joinRequest, acknowledgeCallback) =>
      joinConversationRoom(socket, joinRequest, acknowledgeCallback),
    )
    socket.on(CONVERSATION_LEAVE_EVENT, (leaveRequest, acknowledgeCallback) =>
      leaveConversationRoom(socket, leaveRequest, acknowledgeCallback),
    )
  })

  return socketServer
}

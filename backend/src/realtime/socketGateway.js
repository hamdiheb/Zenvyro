import { Server as SocketIoServer } from 'socket.io'
import cookieParser from 'cookie-parser'
import { environmentConfig } from '../config/environmentConfig.js'
import { pool } from '../db/databasePool.js'
import { findLiveSessionByTokenHash } from '../repositories/sessionsRepository.js'
import { hashSessionToken } from '../services/sessionTokenService.js'

const NOT_SIGNED_IN_MESSAGE = 'You must be signed in.'
const SESSION_ENDED_MESSAGE = 'Your session has ended. Please sign in again.'
const SESSION_CHECK_FAILED_MESSAGE = 'Could not verify your session.'

// The browser sends the same HttpOnly session cookie that the REST API uses, so the socket
// is checked against the sessions table exactly like a REST request.
async function authenticateSocketConnection(socket, nextFunction) {
  try {
    const sessionToken = socket.request.cookies?.[environmentConfig.sessionCookieName]
    if (!sessionToken) {
      return nextFunction(new Error(NOT_SIGNED_IN_MESSAGE))
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

  return socketServer
}

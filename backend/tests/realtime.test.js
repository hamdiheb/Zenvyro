import request from 'supertest'
import { createServer } from 'node:http'
import { io as createSocketClient } from 'socket.io-client'
import { app } from '../src/app.js'
import { environmentConfig } from '../src/config/environmentConfig.js'
import { createSocketGateway } from '../src/realtime/socketGateway.js'
import { pool } from '../src/db/databasePool.js'
import {
  CONVERSATION_JOIN_EVENT,
  CONVERSATION_LEAVE_EVENT,
} from '../src/realtime/realtimeEventNames.js'
import {
  prepareTestDatabase,
  clearTestDatabase,
  closeTestDatabase,
} from './helpers/databaseTestHelper.js'

const SESSION_COOKIE_NAME = environmentConfig.sessionCookieName

function extractSessionCookieHeader(response) {
  const setCookieHeaders = response.headers['set-cookie'] ?? []
  const sessionCookie = setCookieHeaders.find((header) => header.startsWith(`${SESSION_COOKIE_NAME}=`))
  return sessionCookie.split(';')[0]
}

async function signUpBusinessOwner({ businessName, email }) {
  const response = await request(app)
    .post('/api/authentication/sign-up')
    .send({ businessName, name: 'Staff Member', email, password: 'correct-horse-battery' })
  if (response.status !== 201) {
    throw new Error(`Sign-up failed with ${response.status}: ${JSON.stringify(response.body)}`)
  }
  return { cookieHeader: extractSessionCookieHeader(response), businessId: response.body.business.id }
}

// Waits for the client to connect, or rejects with the server's connect error message.
function connectSocketClient(serverPort, cookieHeader) {
  const socketClient = createSocketClient(`http://localhost:${serverPort}`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    extraHeaders: cookieHeader ? { Cookie: cookieHeader } : {},
  })
  return new Promise((resolve, reject) => {
    socketClient.once('connect', () => resolve(socketClient))
    socketClient.once('connect_error', (error) => {
      socketClient.close()
      reject(error)
    })
  })
}

let httpServer
let serverPort

beforeAll(async () => {
  await prepareTestDatabase()
  httpServer = createServer(app)
  createSocketGateway(httpServer)
  await new Promise((resolve) => httpServer.listen(0, resolve))
  serverPort = httpServer.address().port
})

beforeEach(async () => {
  await clearTestDatabase()
})

afterAll(async () => {
  await new Promise((resolve) => httpServer.close(resolve))
  await closeTestDatabase()
})

describe('Socket.IO authentication', () => {
  it('rejects a connection without a session cookie', async () => {
    await expect(connectSocketClient(serverPort, null)).rejects.toThrow('You must be signed in.')
  })

  it('rejects a connection with a session cookie that does not match any session', async () => {
    const unknownCookieHeader = `${SESSION_COOKIE_NAME}=not-a-real-session-token`
    await expect(connectSocketClient(serverPort, unknownCookieHeader)).rejects.toThrow(
      'Your session has ended. Please sign in again.',
    )
  })

  it('accepts a connection that carries a live staff session cookie', async () => {
    const { cookieHeader } = await signUpBusinessOwner({
      businessName: 'Socket Shop',
      email: 'owner@socket-shop.test',
    })

    const socketClient = await connectSocketClient(serverPort, cookieHeader)
    expect(socketClient.connected).toBe(true)
    socketClient.close()
  })
})

async function insertConversationForBusiness(businessId, customerName) {
  const customerResult = await pool.query(
    `INSERT INTO customers (business_id, name) VALUES ($1, $2) RETURNING id`,
    [businessId, customerName],
  )
  const conversationResult = await pool.query(
    `INSERT INTO conversations (business_id, customer_id) VALUES ($1, $2) RETURNING id`,
    [businessId, customerResult.rows[0].id],
  )
  return conversationResult.rows[0].id
}

// Emits an event and resolves with the acknowledgement the server sends back.
function emitWithAcknowledgement(socketClient, eventName, payload) {
  return new Promise((resolve) => socketClient.emit(eventName, payload, resolve))
}

describe('conversation rooms', () => {
  it('lets a socket join a conversation that belongs to its business', async () => {
    const { cookieHeader, businessId } = await signUpBusinessOwner({
      businessName: 'Room Shop',
      email: 'owner@room-shop.test',
    })
    const conversationId = await insertConversationForBusiness(businessId, 'Ada Customer')

    const socketClient = await connectSocketClient(serverPort, cookieHeader)
    const acknowledgement = await emitWithAcknowledgement(socketClient, CONVERSATION_JOIN_EVENT, { conversationId })
    expect(acknowledgement).toEqual({ isSuccessful: true, conversationId })
    socketClient.close()
  })

  it('refuses to join a conversation that belongs to another business', async () => {
    const { businessId: otherBusinessId } = await signUpBusinessOwner({
      businessName: 'Other Shop',
      email: 'owner@other-shop.test',
    })
    const otherConversationId = await insertConversationForBusiness(otherBusinessId, 'Other Customer')

    const { cookieHeader } = await signUpBusinessOwner({
      businessName: 'Intruder Shop',
      email: 'owner@intruder-shop.test',
    })
    const socketClient = await connectSocketClient(serverPort, cookieHeader)
    const acknowledgement = await emitWithAcknowledgement(socketClient, CONVERSATION_JOIN_EVENT, {
      conversationId: otherConversationId,
    })
    expect(acknowledgement).toEqual({ isSuccessful: false, error: 'Conversation not found.' })
    socketClient.close()
  })

  it('refuses a malformed conversation id without touching the database', async () => {
    const { cookieHeader } = await signUpBusinessOwner({
      businessName: 'Malformed Shop',
      email: 'owner@malformed-shop.test',
    })
    const socketClient = await connectSocketClient(serverPort, cookieHeader)
    const acknowledgement = await emitWithAcknowledgement(socketClient, CONVERSATION_JOIN_EVENT, {
      conversationId: 'not-a-uuid',
    })
    expect(acknowledgement).toEqual({ isSuccessful: false, error: 'Conversation not found.' })
    socketClient.close()
  })

  it('acknowledges a leave request for a joined conversation', async () => {
    const { cookieHeader, businessId } = await signUpBusinessOwner({
      businessName: 'Leave Shop',
      email: 'owner@leave-shop.test',
    })
    const conversationId = await insertConversationForBusiness(businessId, 'Leaving Customer')

    const socketClient = await connectSocketClient(serverPort, cookieHeader)
    await emitWithAcknowledgement(socketClient, CONVERSATION_JOIN_EVENT, { conversationId })
    const acknowledgement = await emitWithAcknowledgement(socketClient, CONVERSATION_LEAVE_EVENT, { conversationId })
    expect(acknowledgement).toEqual({ isSuccessful: true, conversationId })
    socketClient.close()
  })
})

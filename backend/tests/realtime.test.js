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
  MESSAGE_CREATED_EVENT,
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
  // The same wiring as server.js: controllers find the gateway through app.get('socketServer').
  app.set('socketServer', createSocketGateway(httpServer))
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

describe('message broadcast to a conversation room', () => {
  it('delivers a staff message to sockets in the room and not to other businesses', async () => {
    const { cookieHeader: staffCookieHeader, businessId } = await signUpBusinessOwner({
      businessName: 'Broadcast Shop',
      email: 'owner@broadcast-shop.test',
    })
    const conversationId = await insertConversationForBusiness(businessId, 'Broadcast Customer')
    const { cookieHeader: otherCookieHeader } = await signUpBusinessOwner({
      businessName: 'Bystander Shop',
      email: 'owner@bystander-shop.test',
    })

    const joinedSocketClient = await connectSocketClient(serverPort, staffCookieHeader)
    await emitWithAcknowledgement(joinedSocketClient, CONVERSATION_JOIN_EVENT, { conversationId })
    const bystanderSocketClient = await connectSocketClient(serverPort, otherCookieHeader)
    const receivedByBystander = []
    bystanderSocketClient.on(MESSAGE_CREATED_EVENT, (event) => receivedByBystander.push(event))

    const receivedMessagePromise = new Promise((resolve) => {
      joinedSocketClient.once(MESSAGE_CREATED_EVENT, resolve)
    })
    const postResponse = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Cookie', staffCookieHeader)
      .send({ body: 'Hello from the agent' })
    expect(postResponse.status).toBe(201)

    const receivedEvent = await receivedMessagePromise
    expect(receivedEvent.conversationId).toBe(conversationId)
    expect(receivedEvent.message).toEqual(postResponse.body.message)
    expect(receivedEvent.message.body).toBe('Hello from the agent')

    // The other business's socket is connected but never joined this room, so it must receive nothing.
    expect(receivedByBystander).toEqual([])

    joinedSocketClient.close()
    bystanderSocketClient.close()
  })
})

// Connects as a website visitor. The widget session token goes in the handshake auth object, not a cookie.
// cookieHeader simulates a browser that is also signed in as staff on the same origin as the widget iframe.
function connectVisitorSocketClient(serverPort, widgetSessionToken, cookieHeader = null) {
  const socketClient = createSocketClient(`http://localhost:${serverPort}`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: { widgetSessionToken },
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

async function startVisitorSession(widgetKey) {
  const response = await request(app).post('/api/widget/sessions').send({ widgetKey })
  return response.body
}

async function widgetKeyForBusiness(businessId) {
  const keyResult = await pool.query('SELECT widget_key FROM businesses WHERE id = $1', [businessId])
  return keyResult.rows[0].widget_key
}

describe('website visitor sockets', () => {
  it('rejects a visitor connection with an unknown widget session token', async () => {
    await expect(connectVisitorSocketClient(serverPort, 'not-a-real-token')).rejects.toThrow(
      'Your chat session has ended. Start a new chat.',
    )
  })

  it('places the visitor in their own conversation room and delivers agent replies live', async () => {
    const { cookieHeader: staffCookieHeader, businessId } = await signUpBusinessOwner({
      businessName: 'Visitor Socket Shop',
      email: 'owner@visitor-socket-shop.test',
    })
    const widgetKey = await widgetKeyForBusiness(businessId)
    const { sessionToken, conversation } = await startVisitorSession(widgetKey)

    const visitorSocketClient = await connectVisitorSocketClient(serverPort, sessionToken)
    const replyReceivedPromise = new Promise((resolve) => {
      visitorSocketClient.once(MESSAGE_CREATED_EVENT, resolve)
    })

    const replyResponse = await request(app)
      .post(`/api/conversations/${conversation.id}/messages`)
      .set('Cookie', staffCookieHeader)
      .send({ body: 'Thanks for waiting, here is your answer' })
    expect(replyResponse.status).toBe(201)

    const receivedEvent = await replyReceivedPromise
    expect(receivedEvent.conversationId).toBe(conversation.id)
    expect(receivedEvent.message.body).toBe('Thanks for waiting, here is your answer')
    visitorSocketClient.close()
  })

  it('treats a socket with a widget token as a visitor even when the browser also sends a staff cookie', async () => {
    const { cookieHeader: staffCookieHeader, businessId } = await signUpBusinessOwner({
      businessName: 'Same Browser Shop',
      email: 'owner@same-browser-shop.test',
    })
    const widgetKey = await widgetKeyForBusiness(businessId)
    const { sessionToken, conversation } = await startVisitorSession(widgetKey)

    const visitorSocketClient = await connectVisitorSocketClient(serverPort, sessionToken, staffCookieHeader)
    const visitorInboxEvents = []
    visitorSocketClient.on('conversation:updated', (event) => visitorInboxEvents.push(event))
    const replyReceivedPromise = new Promise((resolve) => {
      visitorSocketClient.once(MESSAGE_CREATED_EVENT, resolve)
    })

    const replyResponse = await request(app)
      .post(`/api/conversations/${conversation.id}/messages`)
      .set('Cookie', staffCookieHeader)
      .send({ body: 'Reply while the agent is signed in in the same browser' })
    expect(replyResponse.status).toBe(201)

    const receivedEvent = await replyReceivedPromise
    expect(receivedEvent.message.body).toBe('Reply while the agent is signed in in the same browser')
    // It is a visitor socket, so it must not be in the business room.
    expect(visitorInboxEvents).toEqual([])
    visitorSocketClient.close()
  })

  it('refuses a visitor who asks to join another conversation', async () => {
    const { businessId } = await signUpBusinessOwner({
      businessName: 'Nosy Visitor Shop',
      email: 'owner@nosy-visitor-shop.test',
    })
    const widgetKey = await widgetKeyForBusiness(businessId)
    const { sessionToken } = await startVisitorSession(widgetKey)
    const otherConversationId = await insertConversationForBusiness(businessId, 'Someone Else')

    const visitorSocketClient = await connectVisitorSocketClient(serverPort, sessionToken)
    const acknowledgement = await emitWithAcknowledgement(visitorSocketClient, CONVERSATION_JOIN_EVENT, {
      conversationId: otherConversationId,
    })
    expect(acknowledgement).toEqual({ isSuccessful: false, error: 'Conversation not found.' })
    visitorSocketClient.close()
  })

  it('delivers a visitor message to the staff socket that joined the conversation', async () => {
    const { cookieHeader: staffCookieHeader, businessId } = await signUpBusinessOwner({
      businessName: 'Staff Hears Shop',
      email: 'owner@staff-hears-shop.test',
    })
    const widgetKey = await widgetKeyForBusiness(businessId)
    const { sessionToken, conversation } = await startVisitorSession(widgetKey)

    const staffSocketClient = await connectSocketClient(serverPort, staffCookieHeader)
    await emitWithAcknowledgement(staffSocketClient, CONVERSATION_JOIN_EVENT, { conversationId: conversation.id })
    const messageReceivedPromise = new Promise((resolve) => {
      staffSocketClient.once(MESSAGE_CREATED_EVENT, resolve)
    })

    const visitorPostResponse = await request(app)
      .post('/api/widget/messages')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ body: 'Hello, I need help' })
    expect(visitorPostResponse.status).toBe(201)

    const receivedEvent = await messageReceivedPromise
    expect(receivedEvent.message.senderType).toBe('customer')
    expect(receivedEvent.message.body).toBe('Hello, I need help')
    staffSocketClient.close()
  })
})

const CONVERSATION_CREATED_EVENT = 'conversation:created'
const CONVERSATION_UPDATED_EVENT = 'conversation:updated'

// Resolves with the first event of this name that matches the predicate. Attach it before the action.
function waitForEvent(socketClient, eventName, isMatchingEvent = () => true) {
  return new Promise((resolve) => {
    const listener = (event) => {
      if (isMatchingEvent(event)) {
        socketClient.off(eventName, listener)
        resolve(event)
      }
    }
    socketClient.on(eventName, listener)
  })
}

describe('business inbox events', () => {
  it('tells the business staff when a staff member creates a conversation, and no other business', async () => {
    const { cookieHeader: staffCookieHeader } = await signUpBusinessOwner({
      businessName: 'Created Shop',
      email: 'owner@created-shop.test',
    })
    const { cookieHeader: bystanderCookieHeader } = await signUpBusinessOwner({
      businessName: 'Created Bystander Shop',
      email: 'owner@created-bystander.test',
    })

    const inboxSocketClient = await connectSocketClient(serverPort, staffCookieHeader)
    const bystanderSocketClient = await connectSocketClient(serverPort, bystanderCookieHeader)
    const bystanderEvents = []
    bystanderSocketClient.on(CONVERSATION_CREATED_EVENT, (event) => bystanderEvents.push(event))

    const createdEventPromise = waitForEvent(inboxSocketClient, CONVERSATION_CREATED_EVENT)
    const createResponse = await request(app)
      .post('/api/conversations')
      .set('Cookie', staffCookieHeader)
      .send({ customer: { name: 'Inbox Customer' } })
    expect(createResponse.status).toBe(201)

    const createdEvent = await createdEventPromise
    expect(createdEvent.conversation).toEqual(createResponse.body.conversation)
    expect(createdEvent.conversation.customerName).toBe('Inbox Customer')

    expect(bystanderEvents).toEqual([])
    inboxSocketClient.close()
    bystanderSocketClient.close()
  })

  it('tells the business staff when a conversation is updated, without the socket joining its room', async () => {
    const { cookieHeader: staffCookieHeader, businessId } = await signUpBusinessOwner({
      businessName: 'Updated Shop',
      email: 'owner@updated-shop.test',
    })
    const conversationId = await insertConversationForBusiness(businessId, 'Update Customer')

    const inboxSocketClient = await connectSocketClient(serverPort, staffCookieHeader)
    const updatedEventPromise = waitForEvent(
      inboxSocketClient,
      CONVERSATION_UPDATED_EVENT,
      (event) => event.conversation.id === conversationId,
    )
    const patchResponse = await request(app)
      .patch(`/api/conversations/${conversationId}`)
      .set('Cookie', staffCookieHeader)
      .send({ status: 'resolved' })
    expect(patchResponse.status).toBe(200)

    const updatedEvent = await updatedEventPromise
    expect(updatedEvent.conversation).toEqual(patchResponse.body.conversation)
    expect(updatedEvent.conversation.status).toBe('resolved')
    inboxSocketClient.close()
  })

  it('tells the business staff when a staff message moves a conversation in the inbox', async () => {
    const { cookieHeader: staffCookieHeader, businessId } = await signUpBusinessOwner({
      businessName: 'Inbox Message Shop',
      email: 'owner@inbox-message-shop.test',
    })
    const conversationId = await insertConversationForBusiness(businessId, 'Inbox Message Customer')

    const inboxSocketClient = await connectSocketClient(serverPort, staffCookieHeader)
    const updatedEventPromise = waitForEvent(
      inboxSocketClient,
      CONVERSATION_UPDATED_EVENT,
      (event) => event.conversation.id === conversationId,
    )
    const postResponse = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Cookie', staffCookieHeader)
      .send({ body: 'Checking in' })
    expect(postResponse.status).toBe(201)

    const updatedEvent = await updatedEventPromise
    expect(updatedEvent.conversation.lastMessageAt).not.toBeNull()
    inboxSocketClient.close()
  })

  it('tells the business staff when a visitor starts a chat, and the visitor hears no inbox events', async () => {
    const { cookieHeader: staffCookieHeader, businessId } = await signUpBusinessOwner({
      businessName: 'Visitor Inbox Shop',
      email: 'owner@visitor-inbox-shop.test',
    })
    const widgetKey = await widgetKeyForBusiness(businessId)

    const inboxSocketClient = await connectSocketClient(serverPort, staffCookieHeader)
    const createdEventPromise = waitForEvent(inboxSocketClient, CONVERSATION_CREATED_EVENT)
    const { sessionToken, conversation } = await startVisitorSession(widgetKey)

    const createdEvent = await createdEventPromise
    expect(createdEvent.conversation.id).toBe(conversation.id)

    // The visitor's socket must not be in the business room: a staff action afterwards reaches only staff.
    const visitorSocketClient = await connectVisitorSocketClient(serverPort, sessionToken)
    const visitorEvents = []
    visitorSocketClient.on(CONVERSATION_UPDATED_EVENT, (event) => visitorEvents.push(event))
    visitorSocketClient.on(CONVERSATION_CREATED_EVENT, (event) => visitorEvents.push(event))
    const staffUpdatedPromise = waitForEvent(inboxSocketClient, CONVERSATION_UPDATED_EVENT)
    const patchResponse = await request(app)
      .patch(`/api/conversations/${conversation.id}`)
      .set('Cookie', staffCookieHeader)
      .send({ status: 'pending' })
    expect(patchResponse.status).toBe(200)
    await staffUpdatedPromise

    expect(visitorEvents).toEqual([])
    inboxSocketClient.close()
    visitorSocketClient.close()
  })

  it('tells the business staff when a visitor message reopens a resolved conversation', async () => {
    const { cookieHeader: staffCookieHeader, businessId } = await signUpBusinessOwner({
      businessName: 'Reopen Shop',
      email: 'owner@reopen-shop.test',
    })
    const widgetKey = await widgetKeyForBusiness(businessId)
    const { sessionToken, conversation } = await startVisitorSession(widgetKey)
    await request(app)
      .patch(`/api/conversations/${conversation.id}`)
      .set('Cookie', staffCookieHeader)
      .send({ status: 'resolved' })

    const inboxSocketClient = await connectSocketClient(serverPort, staffCookieHeader)
    const reopenedEventPromise = waitForEvent(
      inboxSocketClient,
      CONVERSATION_UPDATED_EVENT,
      (event) => event.conversation.id === conversation.id && event.conversation.status === 'open',
    )
    const visitorPostResponse = await request(app)
      .post('/api/widget/messages')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ body: 'Me again' })
    expect(visitorPostResponse.status).toBe(201)

    const reopenedEvent = await reopenedEventPromise
    expect(reopenedEvent.conversation.status).toBe('open')
    inboxSocketClient.close()
  })
})

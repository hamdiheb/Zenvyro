import request from 'supertest'
import { app } from '../src/app.js'
import { pool } from '../src/db/databasePool.js'
import { environmentConfig } from '../src/config/environmentConfig.js'
import { encodePaginationCursor } from '../src/utils/paginationCursor.js'
import {
  prepareTestDatabase,
  clearTestDatabase,
  closeTestDatabase,
} from './helpers/databaseTestHelper.js'

const SESSION_COOKIE_NAME = environmentConfig.sessionCookieName
const CONVERSATIONS_PATH = '/api/conversations'
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000'

function extractSessionCookieHeader(response) {
  const setCookieHeaders = response.headers['set-cookie'] ?? []
  const sessionCookie = setCookieHeaders.find((header) => header.startsWith(`${SESSION_COOKIE_NAME}=`))
  return sessionCookie.split(';')[0]
}

// Creates a business and its owner through the real sign-up route, returning the cookie header and ids.
async function signUpBusinessOwner({ businessName, email }) {
  const response = await request(app)
    .post('/api/authentication/sign-up')
    .send({ businessName, name: 'Staff Member', email, password: 'correct-horse-battery' })
  if (response.status !== 201) {
    throw new Error(`Sign-up failed with ${response.status}: ${JSON.stringify(response.body)}`)
  }
  return {
    cookieHeader: extractSessionCookieHeader(response),
    userId: response.body.user.id,
    businessId: response.body.business.id,
  }
}

async function insertCustomerRow(businessId, { name, email = null, externalId = null }) {
  const result = await pool.query(
    `INSERT INTO customers (business_id, name, email, external_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [businessId, name, email, externalId],
  )
  return result.rows[0].id
}

async function createConversationForCustomer(cookieHeader, customerId, firstMessageText) {
  const body = firstMessageText ? { customerId, firstMessageText } : { customerId }
  const response = await request(app).post(CONVERSATIONS_PATH).set('Cookie', cookieHeader).send(body)
  return response.body.conversation
}

async function postStaffMessage(cookieHeader, conversationId, bodyText) {
  return request(app)
    .post(`${CONVERSATIONS_PATH}/${conversationId}/messages`)
    .set('Cookie', cookieHeader)
    .send({ body: bodyText })
}

beforeAll(async () => {
  await prepareTestDatabase()
})

beforeEach(async () => {
  await clearTestDatabase()
})

afterAll(async () => {
  await closeTestDatabase()
})

describe('authentication on /api/conversations', () => {
  it('returns 401 for every endpoint without a session', async () => {
    const responses = await Promise.all([
      request(app).get(CONVERSATIONS_PATH),
      request(app).post(CONVERSATIONS_PATH).send({}),
      request(app).get(`${CONVERSATIONS_PATH}/${UNKNOWN_UUID}`),
      request(app).patch(`${CONVERSATIONS_PATH}/${UNKNOWN_UUID}`).send({ status: 'resolved' }),
      request(app).get(`${CONVERSATIONS_PATH}/${UNKNOWN_UUID}/messages`),
      request(app).post(`${CONVERSATIONS_PATH}/${UNKNOWN_UUID}/messages`).send({ body: 'hi' }),
    ])
    responses.forEach((response) => expect(response.status).toBe(401))
  })
})

describe('POST /api/conversations', () => {
  it('creates a conversation for an existing customer with a first staff message', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })
    const customerId = await insertCustomerRow(staff.businessId, { name: 'Grace Buyer', email: 'grace@example.com' })

    const response = await request(app)
      .post(CONVERSATIONS_PATH)
      .set('Cookie', staff.cookieHeader)
      .send({ customerId, firstMessageText: 'Hello, how can I help?' })

    expect(response.status).toBe(201)
    expect(response.body.conversation).toMatchObject({
      customerId,
      customerName: 'Grace Buyer',
      customerEmail: 'grace@example.com',
      mode: 'human',
      status: 'open',
      assignedAgentId: null,
    })
    expect(response.body.conversation.lastMessageAt).not.toBeNull()

    const messageCount = await pool.query('SELECT count(*)::int AS message_count FROM messages WHERE conversation_id = $1', [
      response.body.conversation.id,
    ])
    expect(messageCount.rows[0].message_count).toBe(1)
  })

  it('creates a new customer inside the business when given customer details', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })

    const response = await request(app)
      .post(CONVERSATIONS_PATH)
      .set('Cookie', staff.cookieHeader)
      .send({ customer: { name: '  Linus  ', email: 'Linus@Example.com' } })

    expect(response.status).toBe(201)
    expect(response.body.conversation).toMatchObject({ customerName: 'Linus', customerEmail: 'linus@example.com' })
  })

  it('reuses an existing customer with the same email instead of creating a duplicate', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })
    const existingCustomerId = await insertCustomerRow(staff.businessId, { name: 'Grace', email: 'grace@example.com' })

    const response = await request(app)
      .post(CONVERSATIONS_PATH)
      .set('Cookie', staff.cookieHeader)
      .send({ customer: { name: 'Grace Again', email: 'grace@example.com' } })

    expect(response.status).toBe(201)
    expect(response.body.conversation.customerId).toBe(existingCustomerId)
    const customerCount = await pool.query('SELECT count(*)::int AS customer_count FROM customers WHERE business_id = $1', [
      staff.businessId,
    ])
    expect(customerCount.rows[0].customer_count).toBe(1)
  })

  it('returns 404 when the customer belongs to another business', async () => {
    const acme = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })
    const otherBusiness = await signUpBusinessOwner({ businessName: 'Other Co', email: 'bob@example.com' })
    const acmeCustomerId = await insertCustomerRow(acme.businessId, { name: 'Acme Buyer' })

    const response = await request(app)
      .post(CONVERSATIONS_PATH)
      .set('Cookie', otherBusiness.cookieHeader)
      .send({ customerId: acmeCustomerId })

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Customer not found.' })
  })

  it.each([
    [{}, 'Give either customerId or customer, not both or neither.'],
    [{ customerId: 'x', customer: { name: 'A' } }, 'Give either customerId or customer, not both or neither.'],
    [{ customerId: 'not-a-uuid' }, 'customerId must be a valid id.'],
    [{ customer: { name: '   ' } }, 'customer.name is required and must be at most 120 characters.'],
    [{ customer: { name: 'Ada', email: 'not-an-email' } }, 'customer.email must be a valid email when given.'],
    [{ customer: { name: 'Ada' }, firstMessageText: '   ' }, 'firstMessageText must be 1 to 5000 characters.'],
  ])('rejects invalid body %j with 400', async (requestBody, expectedMessage) => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })

    const response = await request(app).post(CONVERSATIONS_PATH).set('Cookie', staff.cookieHeader).send(requestBody)

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: expectedMessage })
  })
})

describe('GET /api/conversations', () => {
  it('lists newest activity first and filters by view, status, mode and customer', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })
    const customerId = await insertCustomerRow(staff.businessId, { name: 'Grace' })
    const otherCustomerId = await insertCustomerRow(staff.businessId, { name: 'Linus' })
    const olderConversation = await createConversationForCustomer(staff.cookieHeader, customerId)
    const newerConversation = await createConversationForCustomer(staff.cookieHeader, otherCustomerId)
    await postStaffMessage(staff.cookieHeader, olderConversation.id, 'Bumping this one')

    const allResponse = await request(app).get(CONVERSATIONS_PATH).set('Cookie', staff.cookieHeader)
    expect(allResponse.status).toBe(200)
    expect(allResponse.body.conversations.map((conversation) => conversation.id)).toEqual([
      olderConversation.id,
      newerConversation.id,
    ])
    expect(allResponse.body.nextCursor).toBeNull()

    await request(app)
      .patch(`${CONVERSATIONS_PATH}/${newerConversation.id}`)
      .set('Cookie', staff.cookieHeader)
      .send({ status: 'resolved' })

    const resolvedResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}?status=resolved`)
      .set('Cookie', staff.cookieHeader)
    expect(resolvedResponse.body.conversations.map((conversation) => conversation.id)).toEqual([newerConversation.id])

    const customerResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}?customerId=${customerId}`)
      .set('Cookie', staff.cookieHeader)
    expect(customerResponse.body.conversations.map((conversation) => conversation.id)).toEqual([olderConversation.id])

    const unassignedResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}?view=unassigned&mode=human`)
      .set('Cookie', staff.cookieHeader)
    expect(unassignedResponse.body.conversations).toHaveLength(2)

    const mineResponse = await request(app).get(`${CONVERSATIONS_PATH}?view=mine`).set('Cookie', staff.cookieHeader)
    expect(mineResponse.body.conversations).toHaveLength(0)
  })

  it('pages through every conversation without gaps or repeats, even when timestamps tie', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })
    const customerId = await insertCustomerRow(staff.businessId, { name: 'Grace' })
    for (let index = 0; index < 5; index += 1) {
      await createConversationForCustomer(staff.cookieHeader, customerId)
    }
    // Give every row the same timestamp so only the id tie-break separates them.
    await pool.query(`UPDATE conversations SET last_message_at = '2026-01-01 00:00:00+00' WHERE business_id = $1`, [
      staff.businessId,
    ])

    const seenConversationIds = []
    let nextCursor = null
    do {
      const cursorQuery = nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : ''
      const pageResponse = await request(app)
        .get(`${CONVERSATIONS_PATH}?limit=2${cursorQuery}`)
        .set('Cookie', staff.cookieHeader)
      expect(pageResponse.status).toBe(200)
      expect(pageResponse.body.conversations.length).toBeLessThanOrEqual(2)
      seenConversationIds.push(...pageResponse.body.conversations.map((conversation) => conversation.id))
      nextCursor = pageResponse.body.nextCursor
    } while (nextCursor)

    expect(seenConversationIds).toHaveLength(5)
    expect(new Set(seenConversationIds).size).toBe(5)
  })

  it('caps limit at 50 and rejects bad values, cursors and repeated parameters', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })

    const cappedResponse = await request(app).get(`${CONVERSATIONS_PATH}?limit=500`).set('Cookie', staff.cookieHeader)
    expect(cappedResponse.status).toBe(200)

    const badLimitResponse = await request(app).get(`${CONVERSATIONS_PATH}?limit=0`).set('Cookie', staff.cookieHeader)
    expect(badLimitResponse.status).toBe(400)

    const badCursorResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}?cursor=not-a-real-cursor`)
      .set('Cookie', staff.cookieHeader)
    expect(badCursorResponse.status).toBe(400)
    expect(badCursorResponse.body).toEqual({ error: 'Cursor is not valid.' })

    const repeatedStatusResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}?status=open&status=resolved`)
      .set('Cookie', staff.cookieHeader)
    expect(repeatedStatusResponse.status).toBe(400)

    const badViewResponse = await request(app).get(`${CONVERSATIONS_PATH}?view=everything`).set('Cookie', staff.cookieHeader)
    expect(badViewResponse.status).toBe(400)
  })

  it('rejects a cursor whose sort value is not a timestamp', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })
    const forgedCursor = encodePaginationCursor({ sortValue: 'drop table', id: UNKNOWN_UUID })

    const response = await request(app)
      .get(`${CONVERSATIONS_PATH}?cursor=${encodeURIComponent(forgedCursor)}`)
      .set('Cookie', staff.cookieHeader)

    expect(response.status).toBe(400)
  })
})

describe('GET and PATCH /api/conversations/:conversationId', () => {
  it('returns 404 for a malformed id and for an unknown id', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })

    const malformedResponse = await request(app).get(`${CONVERSATIONS_PATH}/abc`).set('Cookie', staff.cookieHeader)
    expect(malformedResponse.status).toBe(404)

    const unknownResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}/${UNKNOWN_UUID}`)
      .set('Cookie', staff.cookieHeader)
    expect(unknownResponse.status).toBe(404)
  })

  it('resolves and reopens a conversation, keeping resolved_at in step with status', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })
    const customerId = await insertCustomerRow(staff.businessId, { name: 'Grace' })
    const conversation = await createConversationForCustomer(staff.cookieHeader, customerId)

    const resolveResponse = await request(app)
      .patch(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', staff.cookieHeader)
      .send({ status: 'resolved' })
    expect(resolveResponse.status).toBe(200)
    expect(resolveResponse.body.conversation.status).toBe('resolved')
    expect(resolveResponse.body.conversation.resolvedAt).not.toBeNull()

    const modeResponse = await request(app)
      .patch(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', staff.cookieHeader)
      .send({ mode: 'ai' })
    expect(modeResponse.body.conversation).toMatchObject({ mode: 'ai', status: 'resolved' })
    expect(modeResponse.body.conversation.resolvedAt).not.toBeNull()

    const reopenResponse = await request(app)
      .patch(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', staff.cookieHeader)
      .send({ status: 'open' })
    expect(reopenResponse.body.conversation).toMatchObject({ status: 'open', resolvedAt: null })
  })

  it('rejects an empty update and invalid values with 400', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })
    const customerId = await insertCustomerRow(staff.businessId, { name: 'Grace' })
    const conversation = await createConversationForCustomer(staff.cookieHeader, customerId)

    const emptyResponse = await request(app).patch(`${CONVERSATIONS_PATH}/${conversation.id}`).set('Cookie', staff.cookieHeader).send({})
    expect(emptyResponse.status).toBe(400)

    const invalidStatusResponse = await request(app)
      .patch(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', staff.cookieHeader)
      .send({ status: 'closed' })
    expect(invalidStatusResponse.status).toBe(400)
  })
})

describe('messages on /api/conversations/:conversationId/messages', () => {
  it('posts staff messages, updates last_message_at, and lists them oldest first within each page', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })
    const customerId = await insertCustomerRow(staff.businessId, { name: 'Grace' })
    const conversation = await createConversationForCustomer(staff.cookieHeader, customerId)

    const bodies = ['first', 'second', 'third', 'fourth', 'fifth']
    for (const bodyText of bodies) {
      const postResponse = await postStaffMessage(staff.cookieHeader, conversation.id, bodyText)
      expect(postResponse.status).toBe(201)
      expect(postResponse.body.message).toMatchObject({ senderType: 'agent', senderId: staff.userId, body: bodyText })
    }

    const newestPageResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}/${conversation.id}/messages?limit=2`)
      .set('Cookie', staff.cookieHeader)
    expect(newestPageResponse.body.messages.map((message) => message.body)).toEqual(['fourth', 'fifth'])
    expect(newestPageResponse.body.nextCursor).not.toBeNull()

    const olderPageResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}/${conversation.id}/messages?limit=2&cursor=${encodeURIComponent(newestPageResponse.body.nextCursor)}`)
      .set('Cookie', staff.cookieHeader)
    expect(olderPageResponse.body.messages.map((message) => message.body)).toEqual(['second', 'third'])

    const oldestPageResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}/${conversation.id}/messages?limit=2&cursor=${encodeURIComponent(olderPageResponse.body.nextCursor)}`)
      .set('Cookie', staff.cookieHeader)
    expect(oldestPageResponse.body.messages.map((message) => message.body)).toEqual(['first'])
    expect(oldestPageResponse.body.nextCursor).toBeNull()

    const listResponse = await request(app).get(CONVERSATIONS_PATH).set('Cookie', staff.cookieHeader)
    expect(listResponse.body.conversations[0].lastMessageAt).not.toBeNull()
    expect(listResponse.body.conversations[0].lastMessage).toEqual({
      preview: 'fifth',
      senderType: 'agent',
      createdAt: expect.any(String),
    })
  })

  it('shows a null lastMessage before any message and cuts long previews to 200 characters', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Preview Shop', email: 'owner@preview-shop.test' })
    const customerId = await insertCustomerRow(staff.businessId, { name: 'Linus' })
    const conversation = await createConversationForCustomer(staff.cookieHeader, customerId)

    const emptyResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', staff.cookieHeader)
    expect(emptyResponse.body.conversation.lastMessage).toBeNull()

    await postStaffMessage(staff.cookieHeader, conversation.id, 'x'.repeat(300))
    const longResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', staff.cookieHeader)
    expect(longResponse.body.conversation.lastMessage.preview).toHaveLength(200)
  })

  it('refuses to post to a resolved conversation with 409', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })
    const customerId = await insertCustomerRow(staff.businessId, { name: 'Grace' })
    const conversation = await createConversationForCustomer(staff.cookieHeader, customerId)
    await request(app)
      .patch(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', staff.cookieHeader)
      .send({ status: 'resolved' })

    const response = await postStaffMessage(staff.cookieHeader, conversation.id, 'Too late')

    expect(response.status).toBe(409)
    expect(response.body.error).toMatch(/resolved/)
  })

  it('rejects an empty message body with 400', async () => {
    const staff = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })
    const customerId = await insertCustomerRow(staff.businessId, { name: 'Grace' })
    const conversation = await createConversationForCustomer(staff.cookieHeader, customerId)

    const response = await postStaffMessage(staff.cookieHeader, conversation.id, '   ')

    expect(response.status).toBe(400)
  })
})

describe('tenant isolation', () => {
  it('hides another business conversations from read, list, update, history and post with 404 or empty results', async () => {
    const acme = await signUpBusinessOwner({ businessName: 'Acme Shoes', email: 'ada@example.com' })
    const otherBusiness = await signUpBusinessOwner({ businessName: 'Other Co', email: 'bob@example.com' })
    const acmeCustomerId = await insertCustomerRow(acme.businessId, { name: 'Acme Buyer' })
    const acmeConversation = await createConversationForCustomer(acme.cookieHeader, acmeCustomerId, 'Private message')

    const listResponse = await request(app).get(CONVERSATIONS_PATH).set('Cookie', otherBusiness.cookieHeader)
    expect(listResponse.body.conversations).toEqual([])

    const readResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}/${acmeConversation.id}`)
      .set('Cookie', otherBusiness.cookieHeader)
    expect(readResponse.status).toBe(404)

    const updateResponse = await request(app)
      .patch(`${CONVERSATIONS_PATH}/${acmeConversation.id}`)
      .set('Cookie', otherBusiness.cookieHeader)
      .send({ status: 'resolved' })
    expect(updateResponse.status).toBe(404)

    const historyResponse = await request(app)
      .get(`${CONVERSATIONS_PATH}/${acmeConversation.id}/messages`)
      .set('Cookie', otherBusiness.cookieHeader)
    expect(historyResponse.status).toBe(404)

    const postResponse = await postStaffMessage(otherBusiness.cookieHeader, acmeConversation.id, 'Intrusion')
    expect(postResponse.status).toBe(404)

    const unchangedRow = await pool.query('SELECT status FROM conversations WHERE id = $1', [acmeConversation.id])
    expect(unchangedRow.rows[0].status).toBe('open')
  })
})

async function insertAgentUserRow(businessId, email) {
  const result = await pool.query(
    `INSERT INTO users (business_id, name, email, password_hash, role)
     VALUES ($1, 'Agent Person', $2, 'not-used-for-sign-in', 'agent') RETURNING id`,
    [businessId, email],
  )
  return result.rows[0].id
}

describe('assigning conversations with PATCH', () => {
  it('assigns a conversation to a staff member of the same business and unassigns it with null', async () => {
    const owner = await signUpBusinessOwner({ businessName: 'Assign Shop', email: 'owner@assign-shop.test' })
    const agentUserId = await insertAgentUserRow(owner.businessId, 'agent@assign-shop.test')
    const customerId = await insertCustomerRow(owner.businessId, { name: 'Assign Customer' })
    const conversation = await createConversationForCustomer(owner.cookieHeader, customerId)

    const assignResponse = await request(app)
      .patch(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', owner.cookieHeader)
      .send({ assignedAgentId: agentUserId })
    expect(assignResponse.status).toBe(200)
    expect(assignResponse.body.conversation.assignedAgentId).toBe(agentUserId)

    const unassignResponse = await request(app)
      .patch(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', owner.cookieHeader)
      .send({ assignedAgentId: null })
    expect(unassignResponse.status).toBe(200)
    expect(unassignResponse.body.conversation.assignedAgentId).toBeNull()
  })

  it('leaves the assignee alone when only status changes', async () => {
    const owner = await signUpBusinessOwner({ businessName: 'Keep Assignee Shop', email: 'owner@keep-assignee.test' })
    const agentUserId = await insertAgentUserRow(owner.businessId, 'agent@keep-assignee.test')
    const customerId = await insertCustomerRow(owner.businessId, { name: 'Keep Customer' })
    const conversation = await createConversationForCustomer(owner.cookieHeader, customerId)
    await request(app)
      .patch(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', owner.cookieHeader)
      .send({ assignedAgentId: agentUserId })

    const response = await request(app)
      .patch(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', owner.cookieHeader)
      .send({ status: 'pending' })
    expect(response.body.conversation.assignedAgentId).toBe(agentUserId)
    expect(response.body.conversation.status).toBe('pending')
  })

  it('refuses an assignee from another business with 400', async () => {
    const owner = await signUpBusinessOwner({ businessName: 'Local Shop', email: 'owner@local-shop.test' })
    const otherOwner = await signUpBusinessOwner({ businessName: 'Remote Shop', email: 'owner@remote-shop.test' })
    const outsiderUserId = await insertAgentUserRow(otherOwner.businessId, 'agent@remote-shop.test')
    const customerId = await insertCustomerRow(owner.businessId, { name: 'Local Customer' })
    const conversation = await createConversationForCustomer(owner.cookieHeader, customerId)

    const response = await request(app)
      .patch(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', owner.cookieHeader)
      .send({ assignedAgentId: outsiderUserId })
    expect(response.status).toBe(400)
    expect(response.body.error).toBe('assignedAgentId must be a staff member of this business.')
  })

  it('rejects a malformed assignedAgentId with 400', async () => {
    const owner = await signUpBusinessOwner({ businessName: 'Malformed Assign Shop', email: 'owner@malformed-assign.test' })
    const customerId = await insertCustomerRow(owner.businessId, { name: 'Malformed Customer' })
    const conversation = await createConversationForCustomer(owner.cookieHeader, customerId)

    const response = await request(app)
      .patch(`${CONVERSATIONS_PATH}/${conversation.id}`)
      .set('Cookie', owner.cookieHeader)
      .send({ assignedAgentId: 'someone' })
    expect(response.status).toBe(400)
  })
})

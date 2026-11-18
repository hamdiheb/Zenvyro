import request from 'supertest'
import { createHash } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db/databasePool.js'
import {
  prepareTestDatabase,
  clearTestDatabase,
  closeTestDatabase,
} from './helpers/databaseTestHelper.js'

const WIDGET_SESSIONS_PATH = '/api/widget/sessions'
const UNKNOWN_WIDGET_KEY = 'wk_00000000000000000000000000000000'

async function signUpBusinessAndReadWidgetKey({ businessName, email }) {
  const signUpResponse = await request(app)
    .post('/api/authentication/sign-up')
    .send({ businessName, name: 'Owner', email, password: 'correct-horse-battery' })
  const businessId = signUpResponse.body.business.id
  const keyResult = await pool.query('SELECT widget_key FROM businesses WHERE id = $1', [businessId])
  return { businessId, widgetKey: keyResult.rows[0].widget_key }
}

function hashToken(sessionToken) {
  return createHash('sha256').update(sessionToken).digest('hex')
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

describe('POST /api/widget/sessions', () => {
  it('starts a visitor session with a customer, a conversation and a bearer token', async () => {
    const { businessId, widgetKey } = await signUpBusinessAndReadWidgetKey({
      businessName: 'Widget Shop',
      email: 'owner@widget-shop.test',
    })

    const response = await request(app)
      .post(WIDGET_SESSIONS_PATH)
      .send({ widgetKey, name: 'Visitor Ada', email: 'Ada@Example.com' })

    expect(response.status).toBe(201)
    expect(response.body.sessionToken).toEqual(expect.any(String))
    expect(response.body.customer.name).toBe('Visitor Ada')
    expect(response.body.conversation.id).toEqual(expect.any(String))

    const conversationResult = await pool.query(
      `SELECT business_id, customer_id FROM conversations WHERE id = $1`,
      [response.body.conversation.id],
    )
    expect(conversationResult.rows[0].business_id).toBe(businessId)
    expect(conversationResult.rows[0].customer_id).toBe(response.body.customer.id)

    const customerResult = await pool.query('SELECT email FROM customers WHERE id = $1', [
      response.body.customer.id,
    ])
    expect(customerResult.rows[0].email).toBe('ada@example.com')
  })

  it('stores only the SHA-256 hash of the token, never the raw token', async () => {
    const { widgetKey } = await signUpBusinessAndReadWidgetKey({
      businessName: 'Hash Shop',
      email: 'owner@hash-shop.test',
    })

    const response = await request(app).post(WIDGET_SESSIONS_PATH).send({ widgetKey })
    const storedRows = (await pool.query('SELECT token_hash, expires_at > now() AS is_live FROM widget_sessions')).rows

    expect(storedRows).toHaveLength(1)
    expect(storedRows[0].token_hash).toBe(hashToken(response.body.sessionToken))
    expect(storedRows[0].token_hash).not.toBe(response.body.sessionToken)
    expect(storedRows[0].is_live).toBe(true)
  })

  it('uses a default visitor name when none is given', async () => {
    const { widgetKey } = await signUpBusinessAndReadWidgetKey({
      businessName: 'Default Name Shop',
      email: 'owner@default-name-shop.test',
    })

    const response = await request(app).post(WIDGET_SESSIONS_PATH).send({ widgetKey })
    expect(response.status).toBe(201)
    expect(response.body.customer.name).toBe('Website visitor')
  })

  it('returns 401 for a well-formed widget key that matches no business', async () => {
    const response = await request(app).post(WIDGET_SESSIONS_PATH).send({ widgetKey: UNKNOWN_WIDGET_KEY })
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('The widget key is not valid.')
  })

  it('returns 400 for a malformed widget key', async () => {
    const response = await request(app).post(WIDGET_SESSIONS_PATH).send({ widgetKey: 'not-a-key' })
    expect(response.status).toBe(400)
    expect(response.body.error).toBe('widgetKey is required and must be a valid widget key.')
  })

  it('returns 400 for an invalid visitor email', async () => {
    const { widgetKey } = await signUpBusinessAndReadWidgetKey({
      businessName: 'Email Check Shop',
      email: 'owner@email-check-shop.test',
    })
    const response = await request(app)
      .post(WIDGET_SESSIONS_PATH)
      .send({ widgetKey, email: 'not-an-email' })
    expect(response.status).toBe(400)
    expect(response.body.error).toBe('email must be a valid email when given.')
  })

  it('answers the browser preflight from any origin, without credentials', async () => {
    const response = await request(app)
      .options(WIDGET_SESSIONS_PATH)
      .set('Origin', 'https://customer-store.example')
      .set('Access-Control-Request-Method', 'POST')

    expect(response.headers['access-control-allow-origin']).toBe('https://customer-store.example')
    expect(response.headers['access-control-allow-credentials']).toBeUndefined()
  })
})

async function signUpStaffCookieAndWidgetKey({ businessName, email }) {
  const signUpResponse = await request(app)
    .post('/api/authentication/sign-up')
    .send({ businessName, name: 'Owner', email, password: 'correct-horse-battery' })
  const setCookies = signUpResponse.headers['set-cookie'] ?? []
  const staffCookieHeader = setCookies.find((header) => header.startsWith('zenvyro_session=')).split(';')[0]
  const keyResult = await pool.query('SELECT widget_key FROM businesses WHERE id = $1', [
    signUpResponse.body.business.id,
  ])
  return { staffCookieHeader, widgetKey: keyResult.rows[0].widget_key }
}

describe('GET /api/widget/session', () => {
  it('returns the visitor conversation and messages, without agent or sender ids', async () => {
    const { staffCookieHeader, widgetKey } = await signUpStaffCookieAndWidgetKey({
      businessName: 'Read Session Shop',
      email: 'owner@read-session-shop.test',
    })
    const startResponse = await request(app).post(WIDGET_SESSIONS_PATH).send({ widgetKey })
    const { sessionToken, conversation } = startResponse.body

    await request(app)
      .post(`/api/conversations/${conversation.id}/messages`)
      .set('Cookie', staffCookieHeader)
      .send({ body: 'Hi, how can I help?' })

    const response = await request(app)
      .get('/api/widget/session')
      .set('Authorization', `Bearer ${sessionToken}`)

    expect(response.status).toBe(200)
    expect(response.body.conversation).toEqual({
      id: conversation.id,
      status: 'open',
      createdAt: expect.any(String),
    })
    expect(response.body.messages).toHaveLength(1)
    expect(response.body.messages[0]).toEqual({
      id: expect.any(String),
      senderType: 'agent',
      body: 'Hi, how can I help?',
      createdAt: expect.any(String),
    })
    expect(response.body.conversation.assignedAgentId).toBeUndefined()
    expect(response.body.messages[0].senderId).toBeUndefined()
  })

  it('returns 401 without a bearer token', async () => {
    const response = await request(app).get('/api/widget/session')
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Start a chat session first.')
  })

  it('returns 401 for an unknown token', async () => {
    const response = await request(app)
      .get('/api/widget/session')
      .set('Authorization', 'Bearer not-a-real-token')
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Your chat session has ended. Start a new chat.')
  })

  it('returns 401 for an expired widget session', async () => {
    const { widgetKey } = await signUpStaffCookieAndWidgetKey({
      businessName: 'Expired Session Shop',
      email: 'owner@expired-session-shop.test',
    })
    const startResponse = await request(app).post(WIDGET_SESSIONS_PATH).send({ widgetKey })
    await pool.query(`UPDATE widget_sessions SET created_at = now() - interval '2 days', expires_at = now() - interval '1 day'`)

    const response = await request(app)
      .get('/api/widget/session')
      .set('Authorization', `Bearer ${startResponse.body.sessionToken}`)
    expect(response.status).toBe(401)
  })

  it('does not accept the staff session cookie in place of a widget token', async () => {
    const { staffCookieHeader } = await signUpStaffCookieAndWidgetKey({
      businessName: 'Cookie Only Shop',
      email: 'owner@cookie-only-shop.test',
    })
    const response = await request(app).get('/api/widget/session').set('Cookie', staffCookieHeader)
    expect(response.status).toBe(401)
  })
})

import request from 'supertest'
import { app } from '../src/app.js'
import { pool } from '../src/db/databasePool.js'
import { environmentConfig } from '../src/config/environmentConfig.js'
import {
  prepareTestDatabase,
  clearTestDatabase,
  closeTestDatabase,
} from './helpers/databaseTestHelper.js'

const LABELS_PATH = '/api/labels'
const SESSION_COOKIE_NAME = environmentConfig.sessionCookieName

async function signUpOwner({ businessName, email }) {
  const response = await request(app)
    .post('/api/authentication/sign-up')
    .send({ businessName, name: 'Owner', email, password: 'correct-horse-battery' })
  const setCookies = response.headers['set-cookie'] ?? []
  const cookieHeader = setCookies.find((header) => header.startsWith(`${SESSION_COOKIE_NAME}=`)).split(';')[0]
  return { cookieHeader, businessId: response.body.business.id }
}

async function createLabelThroughApi(cookieHeader, name, colorHex) {
  const body = colorHex ? { name, colorHex } : { name }
  const response = await request(app).post(LABELS_PATH).set('Cookie', cookieHeader).send(body)
  return response.body.label
}

async function createConversationThroughApi(cookieHeader, businessId) {
  const customerResult = await pool.query(`INSERT INTO customers (business_id, name) VALUES ($1, 'Label Customer') RETURNING id`, [
    businessId,
  ])
  const response = await request(app)
    .post('/api/conversations')
    .set('Cookie', cookieHeader)
    .send({ customerId: customerResult.rows[0].id })
  return response.body.conversation
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

describe('labels', () => {
  it('creates a label with the default colour and lists it by name', async () => {
    const owner = await signUpOwner({ businessName: 'Label List Shop', email: 'owner@label-list.test' })
    const createResponse = await request(app)
      .post(LABELS_PATH)
      .set('Cookie', owner.cookieHeader)
      .send({ name: 'Refund' })
    expect(createResponse.status).toBe(201)
    expect(createResponse.body.label).toEqual({ id: expect.any(String), name: 'Refund', colorHex: '#4a6cf7' })

    await createLabelThroughApi(owner.cookieHeader, 'Billing', '#00aa55')
    const listResponse = await request(app).get(LABELS_PATH).set('Cookie', owner.cookieHeader)
    expect(listResponse.body.labels.map((label) => label.name)).toEqual(['Billing', 'Refund'])
  })

  it('rejects a duplicate label name inside one business with 409', async () => {
    const owner = await signUpOwner({ businessName: 'Dupe Label Shop', email: 'owner@dupe-label.test' })
    await createLabelThroughApi(owner.cookieHeader, 'Urgent')
    const response = await request(app).post(LABELS_PATH).set('Cookie', owner.cookieHeader).send({ name: 'Urgent' })
    expect(response.status).toBe(409)
    expect(response.body.error).toBe('A label with this name already exists.')
  })

  it('rejects an invalid colour or an empty name with 400', async () => {
    const owner = await signUpOwner({ businessName: 'Bad Label Shop', email: 'owner@bad-label.test' })
    const badColour = await request(app)
      .post(LABELS_PATH)
      .set('Cookie', owner.cookieHeader)
      .send({ name: 'Colour', colorHex: 'blue' })
    expect(badColour.status).toBe(400)
    const emptyName = await request(app).post(LABELS_PATH).set('Cookie', owner.cookieHeader).send({ name: '   ' })
    expect(emptyName.status).toBe(400)
  })

  it('sets a conversation label set and returns it on the conversation', async () => {
    const owner = await signUpOwner({ businessName: 'Set Labels Shop', email: 'owner@set-labels.test' })
    const refundLabel = await createLabelThroughApi(owner.cookieHeader, 'Refund')
    const deliveryLabel = await createLabelThroughApi(owner.cookieHeader, 'Delivery')
    const conversation = await createConversationThroughApi(owner.cookieHeader, owner.businessId)

    const setResponse = await request(app)
      .put(`/api/conversations/${conversation.id}/labels`)
      .set('Cookie', owner.cookieHeader)
      .send({ labelIds: [refundLabel.id, deliveryLabel.id] })
    expect(setResponse.status).toBe(200)
    expect(setResponse.body.conversation.labels.map((label) => label.name)).toEqual(['Delivery', 'Refund'])

    const replaceResponse = await request(app)
      .put(`/api/conversations/${conversation.id}/labels`)
      .set('Cookie', owner.cookieHeader)
      .send({ labelIds: [refundLabel.id] })
    expect(replaceResponse.body.conversation.labels.map((label) => label.name)).toEqual(['Refund'])

    const emptyResponse = await request(app)
      .put(`/api/conversations/${conversation.id}/labels`)
      .set('Cookie', owner.cookieHeader)
      .send({ labelIds: [] })
    expect(emptyResponse.body.conversation.labels).toEqual([])
  })

  it('shows labels on the conversation list', async () => {
    const owner = await signUpOwner({ businessName: 'List Labels Shop', email: 'owner@list-labels.test' })
    const label = await createLabelThroughApi(owner.cookieHeader, 'VIP')
    const conversation = await createConversationThroughApi(owner.cookieHeader, owner.businessId)
    await request(app)
      .put(`/api/conversations/${conversation.id}/labels`)
      .set('Cookie', owner.cookieHeader)
      .send({ labelIds: [label.id] })

    const listResponse = await request(app).get('/api/conversations').set('Cookie', owner.cookieHeader)
    expect(listResponse.body.conversations[0].labels).toEqual([label])
  })

  it('refuses a label that belongs to another business', async () => {
    const owner = await signUpOwner({ businessName: 'Mine Labels Shop', email: 'owner@mine-labels.test' })
    const otherOwner = await signUpOwner({ businessName: 'Theirs Labels Shop', email: 'owner@theirs-labels.test' })
    const foreignLabel = await createLabelThroughApi(otherOwner.cookieHeader, 'Foreign')
    const conversation = await createConversationThroughApi(owner.cookieHeader, owner.businessId)

    const response = await request(app)
      .put(`/api/conversations/${conversation.id}/labels`)
      .set('Cookie', owner.cookieHeader)
      .send({ labelIds: [foreignLabel.id] })
    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Every label must belong to this business.')
  })

  it('returns 401 for the labels list without a session', async () => {
    const response = await request(app).get(LABELS_PATH)
    expect(response.status).toBe(401)
  })
})

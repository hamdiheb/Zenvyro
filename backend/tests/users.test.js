import request from 'supertest'
import { app } from '../src/app.js'
import { pool } from '../src/db/databasePool.js'
import { environmentConfig } from '../src/config/environmentConfig.js'
import {
  prepareTestDatabase,
  clearTestDatabase,
  closeTestDatabase,
} from './helpers/databaseTestHelper.js'

const USERS_PATH = '/api/users'
const SESSION_COOKIE_NAME = environmentConfig.sessionCookieName

async function signUpOwner({ businessName, name, email }) {
  const response = await request(app)
    .post('/api/authentication/sign-up')
    .send({ businessName, name, email, password: 'correct-horse-battery' })
  const setCookies = response.headers['set-cookie'] ?? []
  const cookieHeader = setCookies.find((header) => header.startsWith(`${SESSION_COOKIE_NAME}=`)).split(';')[0]
  return { cookieHeader, businessId: response.body.business.id }
}

// Adds an agent straight into the users table. The hash is a placeholder that must never be returned.
async function insertAgent(businessId, { name, email }) {
  await pool.query(
    `INSERT INTO users (business_id, name, email, password_hash, role)
     VALUES ($1, $2, $3, 'placeholder-hash-not-for-login', 'agent')`,
    [businessId, name, email],
  )
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

describe('GET /api/users', () => {
  it('rejects a request without a staff session', async () => {
    const response = await request(app).get(USERS_PATH)
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('You must be signed in.')
  })

  it('lists the staff of the signed-in business by name, with role and without password data', async () => {
    const owner = await signUpOwner({
      businessName: 'Staff List Shop',
      name: 'Zoe Owner',
      email: 'owner@staff-list.test',
    })
    await insertAgent(owner.businessId, { name: 'Adam Agent', email: 'agent@staff-list.test' })

    const response = await request(app).get(USERS_PATH).set('Cookie', owner.cookieHeader)

    expect(response.status).toBe(200)
    expect(response.body.users).toEqual([
      { id: expect.any(String), name: 'Adam Agent', email: 'agent@staff-list.test', role: 'agent' },
      { id: expect.any(String), name: 'Zoe Owner', email: 'owner@staff-list.test', role: 'owner' },
    ])
    expect(JSON.stringify(response.body)).not.toContain('password')
  })

  it('does not list staff from another business', async () => {
    const owner = await signUpOwner({
      businessName: 'Own Shop',
      name: 'Own Owner',
      email: 'owner@own-shop.test',
    })
    await signUpOwner({
      businessName: 'Other Shop',
      name: 'Other Owner',
      email: 'owner@other-shop.test',
    })

    const response = await request(app).get(USERS_PATH).set('Cookie', owner.cookieHeader)

    expect(response.body.users.map((user) => user.email)).toEqual(['owner@own-shop.test'])
  })
})

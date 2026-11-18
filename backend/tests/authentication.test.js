import request from 'supertest'
import { createHash } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db/databasePool.js'
import { environmentConfig } from '../src/config/environmentConfig.js'
import {
  prepareTestDatabase,
  clearTestDatabase,
  closeTestDatabase,
} from './helpers/databaseTestHelper.js'

const SESSION_COOKIE_NAME = environmentConfig.sessionCookieName
const VALID_SIGN_UP_BODY = {
  businessName: 'Acme Shoes',
  name: 'Ada Owner',
  email: 'ada@example.com',
  password: 'correct-horse-battery',
}

function hashToken(sessionToken) {
  return createHash('sha256').update(sessionToken).digest('hex')
}

// Reads the raw session cookie value from a Set-Cookie response header.
function extractSessionToken(response) {
  const setCookieHeaders = response.headers['set-cookie'] ?? []
  const sessionCookie = setCookieHeaders.find((header) => header.startsWith(`${SESSION_COOKIE_NAME}=`))
  if (!sessionCookie) {
    return null
  }
  return decodeURIComponent(sessionCookie.split(';')[0].slice(SESSION_COOKIE_NAME.length + 1))
}

function buildCookieHeader(sessionToken) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`
}

async function countSessionRows() {
  const result = await pool.query('SELECT count(*)::int AS session_count FROM sessions')
  return result.rows[0].session_count
}

async function signUpAcmeOwner() {
  return request(app).post('/api/authentication/sign-up').send(VALID_SIGN_UP_BODY)
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

describe('POST /api/authentication/sign-up', () => {
  it('creates the business, owner and a session, and sets an HttpOnly cookie', async () => {
    const response = await signUpAcmeOwner()

    expect(response.status).toBe(201)
    expect(response.body.user).toMatchObject({ name: 'Ada Owner', email: 'ada@example.com', role: 'owner' })
    expect(response.body.business).toMatchObject({ name: 'Acme Shoes' })
    expect(response.body.user).not.toHaveProperty('password_hash')

    const setCookieHeader = response.headers['set-cookie'].find((header) => header.startsWith(SESSION_COOKIE_NAME))
    expect(setCookieHeader).toMatch(/HttpOnly/i)
    expect(setCookieHeader).toMatch(/SameSite=Lax/i)
    expect(setCookieHeader).toMatch(/Max-Age=259200/)

    expect(await countSessionRows()).toBe(1)
  })

  it('stores only the SHA-256 hash of the session token, never the raw cookie value', async () => {
    const response = await signUpAcmeOwner()
    const sessionToken = extractSessionToken(response)

    const result = await pool.query('SELECT token_hash FROM sessions')
    expect(result.rows[0].token_hash).toBe(hashToken(sessionToken))
    expect(result.rows[0].token_hash).not.toBe(sessionToken)
  })

  it('stores a password hash, not the plain password', async () => {
    await signUpAcmeOwner()

    const result = await pool.query('SELECT password_hash FROM users')
    expect(result.rows[0].password_hash).not.toContain(VALID_SIGN_UP_BODY.password)
    expect(result.rows[0].password_hash).toMatch(/^\$2[aby]\$/)
  })

  it('returns 409 when the email is already registered', async () => {
    await signUpAcmeOwner()
    const duplicateResponse = await request(app)
      .post('/api/authentication/sign-up')
      .send({ ...VALID_SIGN_UP_BODY, businessName: 'Other Shop' })

    expect(duplicateResponse.status).toBe(409)
    expect(duplicateResponse.body.error).toMatch(/already exists/)
  })

  it('rejects an invalid body with 400 and creates nothing', async () => {
    const response = await request(app)
      .post('/api/authentication/sign-up')
      .send({ ...VALID_SIGN_UP_BODY, email: 'not-an-email' })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/valid email/)
    expect(await countSessionRows()).toBe(0)
  })

  it('rejects a password longer than bcrypt can use, with 400', async () => {
    const response = await request(app)
      .post('/api/authentication/sign-up')
      .send({ ...VALID_SIGN_UP_BODY, password: 'x'.repeat(73) })

    expect(response.status).toBe(400)
  })

  it('rolls back the business when the owner insert fails', async () => {
    await signUpAcmeOwner()
    const duplicateResponse = await request(app)
      .post('/api/authentication/sign-up')
      .send({ ...VALID_SIGN_UP_BODY, businessName: 'Rolled Back Shop' })

    expect(duplicateResponse.status).toBe(409)
    const businessResult = await pool.query(`SELECT count(*)::int AS business_count FROM businesses WHERE name = 'Rolled Back Shop'`)
    expect(businessResult.rows[0].business_count).toBe(0)
  })
})

describe('POST /api/authentication/sign-in', () => {
  it('sets a new cookie and adds a new session row', async () => {
    await signUpAcmeOwner()
    const sessionRowsBefore = await countSessionRows()

    const response = await request(app)
      .post('/api/authentication/sign-in')
      .send({ email: 'ada@example.com', password: VALID_SIGN_UP_BODY.password })

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({ email: 'ada@example.com', role: 'owner' })
    expect(response.body.business).toEqual({
      id: response.body.user.businessId,
      name: VALID_SIGN_UP_BODY.businessName,
      slug: expect.any(String),
    })
    expect(extractSessionToken(response)).toEqual(expect.any(String))
    expect(await countSessionRows()).toBe(sessionRowsBefore + 1)
  })

  it('returns the same 401 for a wrong password and for an unknown email', async () => {
    await signUpAcmeOwner()

    const wrongPasswordResponse = await request(app)
      .post('/api/authentication/sign-in')
      .send({ email: 'ada@example.com', password: 'wrong-password-value' })
    const unknownEmailResponse = await request(app)
      .post('/api/authentication/sign-in')
      .send({ email: 'nobody@example.com', password: 'wrong-password-value' })

    expect(wrongPasswordResponse.status).toBe(401)
    expect(unknownEmailResponse.status).toBe(401)
    expect(wrongPasswordResponse.body).toEqual(unknownEmailResponse.body)
    expect(extractSessionToken(wrongPasswordResponse)).toBeNull()
  })

  it('rejects a body with no password with 400', async () => {
    const response = await request(app)
      .post('/api/authentication/sign-in')
      .send({ email: 'ada@example.com' })

    expect(response.status).toBe(400)
  })
})

describe('GET /api/authentication/me', () => {
  it('returns the user when the cookie matches a live session', async () => {
    const signUpResponse = await signUpAcmeOwner()
    const sessionToken = extractSessionToken(signUpResponse)

    const response = await request(app)
      .get('/api/authentication/me')
      .set('Cookie', buildCookieHeader(sessionToken))

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({ email: 'ada@example.com', role: 'owner' })
    expect(response.body.user).not.toHaveProperty('password_hash')
    expect(response.body.business).toEqual(signUpResponse.body.business)
  })

  it('returns 401 when there is no cookie', async () => {
    const response = await request(app).get('/api/authentication/me')
    expect(response.status).toBe(401)
  })

  it('returns 401 for a cookie that matches no session', async () => {
    const response = await request(app)
      .get('/api/authentication/me')
      .set('Cookie', buildCookieHeader('made-up-token-that-is-not-in-the-database'))

    expect(response.status).toBe(401)
    expect(response.headers['set-cookie'][0]).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=;`))
  })

  it('returns 401 when the session has expired, even though the row still exists', async () => {
    const signUpResponse = await signUpAcmeOwner()
    const sessionToken = extractSessionToken(signUpResponse)
    // The schema requires expires_at > created_at, so the session is moved back in time as a whole.
    await pool.query(`UPDATE sessions SET created_at = now() - interval '2 days', expires_at = now() - interval '1 second'`)

    const response = await request(app)
      .get('/api/authentication/me')
      .set('Cookie', buildCookieHeader(sessionToken))

    expect(response.status).toBe(401)
  })

  it('returns 401 after the session row has been deleted from the database', async () => {
    const signUpResponse = await signUpAcmeOwner()
    const sessionToken = extractSessionToken(signUpResponse)
    await pool.query('DELETE FROM sessions')

    const response = await request(app)
      .get('/api/authentication/me')
      .set('Cookie', buildCookieHeader(sessionToken))

    expect(response.status).toBe(401)
  })
})

describe('POST /api/authentication/sign-out', () => {
  it('deletes the session row, clears the cookie, and makes me return 401 afterwards', async () => {
    const signUpResponse = await signUpAcmeOwner()
    const sessionToken = extractSessionToken(signUpResponse)
    const cookieHeader = buildCookieHeader(sessionToken)

    const signOutResponse = await request(app)
      .post('/api/authentication/sign-out')
      .set('Cookie', cookieHeader)

    expect(signOutResponse.status).toBe(204)
    expect(signOutResponse.headers['set-cookie'][0]).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=;`))
    expect(await countSessionRows()).toBe(0)

    const meResponse = await request(app)
      .get('/api/authentication/me')
      .set('Cookie', cookieHeader)
    expect(meResponse.status).toBe(401)
  })

  it('returns 401 when called without a session', async () => {
    const response = await request(app).post('/api/authentication/sign-out')
    expect(response.status).toBe(401)
  })
})

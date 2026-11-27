import request from 'supertest'
import { app } from '../../src/app.js'
import { pool } from '../../src/db/databasePool.js'
import { environmentConfig } from '../../src/config/environmentConfig.js'
import { generateSessionToken, hashSessionToken } from '../../src/services/sessionTokenService.js'

const SESSION_COOKIE_NAME = environmentConfig.sessionCookieName
export const TEST_PASSWORD = 'correct-horse-battery'

export function buildCookieHeader(sessionToken) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`
}

export function extractSessionCookieHeader(response) {
  const setCookieHeaders = response.headers['set-cookie'] ?? []
  const sessionCookie = setCookieHeaders.find((header) => header.startsWith(`${SESSION_COOKIE_NAME}=`))
  return sessionCookie ? sessionCookie.split(';')[0] : null
}

// Signs up a business through the API. The caller is its owner, with a live session cookie.
export async function signUpOwner({ businessName, email, name = 'Olivia Owner' }) {
  const response = await request(app)
    .post('/api/authentication/sign-up')
    .send({ businessName, name, email, password: TEST_PASSWORD })
  if (response.status !== 201) {
    throw new Error(`Sign-up failed with ${response.status}: ${JSON.stringify(response.body)}`)
  }
  return {
    userId: response.body.user.id,
    businessId: response.body.business.id,
    cookieHeader: extractSessionCookieHeader(response),
  }
}

// Inserts a staff member with a live session straight into the database (no bcrypt work, fast).
// The password hash is a placeholder: these users never sign in with a password.
export async function insertStaffMemberWithSession(businessId, { role, email, name = `Test ${role}` }) {
  const userResult = await pool.query(
    `INSERT INTO users (business_id, name, email, password_hash, role)
     VALUES ($1, $2, $3, 'placeholder-hash-not-for-login', $4)
     RETURNING id`,
    [businessId, name, email, role],
  )
  const userId = userResult.rows[0].id
  const sessionToken = generateSessionToken()
  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')`,
    [userId, hashSessionToken(sessionToken)],
  )
  return { userId, businessId, cookieHeader: buildCookieHeader(sessionToken) }
}

// One business with an owner, an admin and an agent, each signed in.
export async function createBusinessWithStaff(businessSlug) {
  const owner = await signUpOwner({ businessName: `${businessSlug} Shop`, email: `owner@${businessSlug}.test` })
  const admin = await insertStaffMemberWithSession(owner.businessId, {
    role: 'admin',
    email: `admin@${businessSlug}.test`,
  })
  const agent = await insertStaffMemberWithSession(owner.businessId, {
    role: 'agent',
    email: `agent@${businessSlug}.test`,
  })
  return { businessId: owner.businessId, owner, admin, agent }
}

export async function countSessionsForUser(userId) {
  const result = await pool.query('SELECT count(*)::int AS session_count FROM sessions WHERE user_id = $1', [userId])
  return result.rows[0].session_count
}

import request from 'supertest'
import { createHash } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db/databasePool.js'
import { setInvitationMailer } from '../src/services/invitationMailService.js'
import {
  prepareTestDatabase,
  clearTestDatabase,
  closeTestDatabase,
} from './helpers/databaseTestHelper.js'
import {
  createBusinessWithStaff,
  signUpOwner,
  extractSessionCookieHeader,
  TEST_PASSWORD,
} from './helpers/staffTestHelper.js'

const INVITATIONS_PATH = '/api/users/invitations'
const ACCEPT_PATH = '/api/authentication/accept-invitation'
const INVALID_INVITATION_MESSAGE = 'This invitation link is invalid, already used or expired.'

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function readTokenFromLink(invitationLink) {
  return invitationLink.split('#token=')[1]
}

async function invite(staffMember, body) {
  return request(app).post(INVITATIONS_PATH).set('Cookie', staffMember.cookieHeader).send(body)
}

async function inviteAndReadToken(staffMember, body) {
  const response = await invite(staffMember, body)
  if (response.status !== 201) {
    throw new Error(`Invitation failed with ${response.status}: ${JSON.stringify(response.body)}`)
  }
  return readTokenFromLink(response.body.invitationLink)
}

function accept(token, { name = 'Nina Newcomer', password = TEST_PASSWORD } = {}) {
  return request(app).post(ACCEPT_PATH).send({ token, name, password })
}

beforeAll(async () => {
  await prepareTestDatabase()
})

beforeEach(async () => {
  await clearTestDatabase()
  setInvitationMailer()
})

afterAll(async () => {
  setInvitationMailer()
  await closeTestDatabase()
})

describe('POST /api/users/invitations', () => {
  it('creates an expiring invitation and returns the link while no mail provider is set', async () => {
    const business = await createBusinessWithStaff('home')

    const response = await invite(business.admin, { email: '  New.Agent@Invite.test ', role: 'agent' })

    expect(response.status).toBe(201)
    expect(response.body.invitation).toMatchObject({
      email: 'new.agent@invite.test',
      role: 'agent',
      invitedByUserId: business.admin.userId,
    })
    expect(response.body.invitationLink).toMatch(/^http:\/\/localhost:5173\/accept-invitation#token=[\w-]{43}$/)

    const expiresInMilliseconds = new Date(response.body.invitation.expiresAt).getTime() - Date.now()
    const sevenDaysInMilliseconds = 7 * 24 * 60 * 60 * 1000
    expect(Math.abs(expiresInMilliseconds - sevenDaysInMilliseconds)).toBeLessThan(60 * 1000)
  })

  it('stores only the SHA-256 hash of the token, never the token itself', async () => {
    const business = await createBusinessWithStaff('home')
    const token = await inviteAndReadToken(business.owner, { email: 'hash@invite.test', role: 'admin' })

    const result = await pool.query('SELECT token_hash FROM user_invitations')
    expect(result.rows).toEqual([{ token_hash: hashToken(token) }])
    const tableText = JSON.stringify((await pool.query('SELECT * FROM user_invitations')).rows)
    expect(tableText).not.toContain(token)
  })

  it('replaces the open invitation when the same email is invited again', async () => {
    const business = await createBusinessWithStaff('home')
    const firstToken = await inviteAndReadToken(business.owner, { email: 'again@invite.test', role: 'agent' })
    const secondToken = await inviteAndReadToken(business.owner, { email: 'again@invite.test', role: 'admin' })

    const result = await pool.query('SELECT role FROM user_invitations')
    expect(result.rows).toEqual([{ role: 'admin' }])
    expect((await accept(firstToken)).status).toBe(400)
    expect((await accept(secondToken)).status).toBe(201)
  })

  it('refuses an email that is already on the staff of this business', async () => {
    const business = await createBusinessWithStaff('home')
    const response = await invite(business.owner, { email: 'agent@home.test', role: 'agent' })

    expect(response.status).toBe(409)
    expect(response.body.error).toBe('This person is already a staff member of your business.')
  })

  it('refuses an email that belongs to another business, with a clear message (Q1)', async () => {
    const business = await createBusinessWithStaff('home')
    await signUpOwner({ businessName: 'Other Shop', email: 'taken@other.test' })

    const response = await invite(business.owner, { email: 'taken@other.test', role: 'agent' })

    expect(response.status).toBe(409)
    expect(response.body.error).toBe(
      'This email already belongs to a staff member of another business. A person can belong to one business only, so ask them for a different email.',
    )
    const countResult = await pool.query('SELECT count(*)::int AS invitation_count FROM user_invitations')
    expect(countResult.rows[0].invitation_count).toBe(0)
  })

  it.each([
    [{ email: 'not-an-email', role: 'agent' }, 'A valid email is required.'],
    [{ email: 'x@invite.test', role: 'owner' }, 'role must be one of: admin, agent.'],
    [{ email: 'x@invite.test' }, 'role must be one of: admin, agent.'],
  ])('refuses the body %j with 400', async (body, expectedError) => {
    const business = await createBusinessWithStaff('home')
    const response = await invite(business.owner, body)

    expect(response.status).toBe(400)
    expect(response.body.error).toBe(expectedError)
  })

  it('hands the link to the mail port and keeps it out of the response when a provider delivers it', async () => {
    const deliveredInvitations = []
    setInvitationMailer({
      async deliverInvitation(invitation) {
        deliveredInvitations.push(invitation)
        return { isLinkReturnedToInviter: false }
      },
    })
    const business = await createBusinessWithStaff('home')

    const response = await invite(business.owner, { email: 'mailed@invite.test', role: 'agent' })

    expect(response.status).toBe(201)
    expect(response.body).not.toHaveProperty('invitationLink')
    expect(deliveredInvitations).toEqual([
      {
        email: 'mailed@invite.test',
        role: 'agent',
        invitationLink: expect.stringMatching(/#token=[\w-]{43}$/),
        businessName: 'home Shop',
        inviterName: 'Olivia Owner',
      },
    ])
  })
})

describe('POST /api/authentication/accept-invitation', () => {
  it('creates the user with the invited role in the inviting business and signs them in', async () => {
    const business = await createBusinessWithStaff('home')
    const token = await inviteAndReadToken(business.admin, { email: 'nina@invite.test', role: 'admin' })

    const response = await accept(token)

    expect(response.status).toBe(201)
    expect(response.body.user).toMatchObject({
      name: 'Nina Newcomer',
      email: 'nina@invite.test',
      role: 'admin',
      businessId: business.businessId,
    })
    expect(response.body.business).toMatchObject({ id: business.businessId, name: 'home Shop' })

    const cookieHeader = extractSessionCookieHeader(response)
    const meResponse = await request(app).get('/api/authentication/me').set('Cookie', cookieHeader)
    expect(meResponse.body.user).toMatchObject({ email: 'nina@invite.test', role: 'admin' })

    const signInResponse = await request(app)
      .post('/api/authentication/sign-in')
      .send({ email: 'nina@invite.test', password: TEST_PASSWORD })
    expect(signInResponse.status).toBe(200)

    const invitationResult = await pool.query('SELECT accepted_at FROM user_invitations')
    expect(invitationResult.rows[0].accepted_at).not.toBeNull()
  })

  it('works only once', async () => {
    const business = await createBusinessWithStaff('home')
    const token = await inviteAndReadToken(business.owner, { email: 'once@invite.test', role: 'agent' })

    expect((await accept(token)).status).toBe(201)
    const secondResponse = await accept(token, { name: 'Someone Else' })

    expect(secondResponse.status).toBe(400)
    expect(secondResponse.body.error).toBe(INVALID_INVITATION_MESSAGE)
  })

  it('lets only one of two simultaneous accepts through', async () => {
    const business = await createBusinessWithStaff('home')
    const token = await inviteAndReadToken(business.owner, { email: 'race@invite.test', role: 'agent' })

    const responses = await Promise.all([accept(token), accept(token)])

    expect(responses.map((response) => response.status).sort()).toEqual([201, 400])
    const userResult = await pool.query(`SELECT count(*)::int AS user_count FROM users WHERE email = 'race@invite.test'`)
    expect(userResult.rows[0].user_count).toBe(1)
  })

  it('refuses an expired invitation', async () => {
    const business = await createBusinessWithStaff('home')
    const token = await inviteAndReadToken(business.owner, { email: 'late@invite.test', role: 'agent' })
    await pool.query(
      `UPDATE user_invitations SET created_at = now() - interval '8 days', expires_at = now() - interval '1 day'`,
    )

    const response = await accept(token)

    expect(response.status).toBe(400)
    expect(response.body.error).toBe(INVALID_INVITATION_MESSAGE)
    const userResult = await pool.query(`SELECT id FROM users WHERE email = 'late@invite.test'`)
    expect(userResult.rows).toHaveLength(0)
  })

  it('refuses an unknown token with the same message', async () => {
    const response = await accept('this-token-was-never-issued')

    expect(response.status).toBe(400)
    expect(response.body.error).toBe(INVALID_INVITATION_MESSAGE)
  })

  it('keeps the invitation usable when the email signed up on its own in the meantime', async () => {
    const business = await createBusinessWithStaff('home')
    const token = await inviteAndReadToken(business.owner, { email: 'eager@invite.test', role: 'agent' })
    await signUpOwner({ businessName: 'Eager Shop', email: 'eager@invite.test' })

    const response = await accept(token)

    expect(response.status).toBe(409)
    expect(response.body.error).toBe('An account with this email already exists.')
    const invitationResult = await pool.query('SELECT accepted_at FROM user_invitations')
    expect(invitationResult.rows[0].accepted_at).toBeNull()
  })

  it.each([
    [{ name: 'Nina', password: TEST_PASSWORD }, 'A valid invitation token is required.'],
    [{ token: 'abc', password: TEST_PASSWORD }, 'Name is required.'],
    [{ token: 'abc', name: 'Nina', password: 'short' }, 'Password must be at least 8 characters.'],
  ])('refuses the body %j with 400', async (body, expectedError) => {
    const response = await request(app).post(ACCEPT_PATH).send(body)

    expect(response.status).toBe(400)
    expect(response.body.error).toBe(expectedError)
  })
})

import request from 'supertest'
import { app } from '../src/app.js'
import { pool } from '../src/db/databasePool.js'
import {
  prepareTestDatabase,
  clearTestDatabase,
  closeTestDatabase,
} from './helpers/databaseTestHelper.js'
import {
  createBusinessWithStaff,
  insertStaffMemberWithSession,
  countSessionsForUser,
} from './helpers/staffTestHelper.js'

const FORBIDDEN_MESSAGE = 'You do not have permission to do this.'

function sendAs(staffMember, { method, path, body }) {
  const pendingRequest = request(app)[method](path).set('Cookie', staffMember.cookieHeader)
  return body === undefined ? pendingRequest : pendingRequest.send(body)
}

// The things a protected route acts on: another agent of the business and one of its conversations.
async function createTargets(businessId, emailPrefix) {
  const targetAgent = await insertStaffMemberWithSession(businessId, {
    role: 'agent',
    email: `${emailPrefix}-target-agent@targets.test`,
  })
  const customerResult = await pool.query(
    `INSERT INTO customers (business_id, name) VALUES ($1, 'Grace Buyer') RETURNING id`,
    [businessId],
  )
  const conversationResult = await pool.query(
    `INSERT INTO conversations (business_id, customer_id, mode) VALUES ($1, $2, 'human') RETURNING id`,
    [businessId, customerResult.rows[0].id],
  )
  return { targetUserId: targetAgent.userId, conversationId: conversationResult.rows[0].id }
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

// Every owner/admin-only route that acts on a resource of one business.
// Acceptance: an agent gets 403, an owner or admin succeeds, another business gets 404.
const PROTECTED_ROUTES = [
  {
    name: 'PATCH /api/users/:userId (change role)',
    successStatus: 200,
    buildRequest: (targets) => ({ method: 'patch', path: `/api/users/${targets.targetUserId}`, body: { role: 'admin' } }),
  },
  {
    name: 'DELETE /api/users/:userId (remove staff member)',
    successStatus: 204,
    buildRequest: (targets) => ({ method: 'delete', path: `/api/users/${targets.targetUserId}` }),
  },
  {
    name: 'PATCH /api/conversations/:conversationId with mode ai (hand back to AI)',
    successStatus: 200,
    buildRequest: (targets) => ({
      method: 'patch',
      path: `/api/conversations/${targets.conversationId}`,
      body: { mode: 'ai' },
    }),
  },
]

describe.each(PROTECTED_ROUTES)('$name', ({ successStatus, buildRequest }) => {
  let homeBusiness
  let otherBusiness
  let targets

  beforeEach(async () => {
    homeBusiness = await createBusinessWithStaff('home')
    otherBusiness = await createBusinessWithStaff('other')
    targets = await createTargets(homeBusiness.businessId, 'home')
  })

  it('refuses an agent with 403', async () => {
    const response = await sendAs(homeBusiness.agent, buildRequest(targets))
    expect(response.status).toBe(403)
    expect(response.body.error).toBe(FORBIDDEN_MESSAGE)
  })

  it.each(['owner', 'admin'])('lets the %s through', async (role) => {
    const response = await sendAs(homeBusiness[role], buildRequest(targets))
    expect(response.status).toBe(successStatus)
  })

  it.each(['owner', 'admin'])('answers 404 to the %s of another business', async (role) => {
    const response = await sendAs(otherBusiness[role], buildRequest(targets))
    expect(response.status).toBe(404)
  })

  it('refuses a request without a session with 401', async () => {
    const { method, path, body } = buildRequest(targets)
    const response = await request(app)[method](path).send(body)
    expect(response.status).toBe(401)
  })
})

describe('POST /api/users/invitations (role check)', () => {
  const invitationBody = { email: 'new-agent@invite.test', role: 'agent' }

  it('refuses an agent with 403 and stores nothing', async () => {
    const business = await createBusinessWithStaff('home')
    const response = await sendAs(business.agent, { method: 'post', path: '/api/users/invitations', body: invitationBody })

    expect(response.status).toBe(403)
    const countResult = await pool.query('SELECT count(*)::int AS invitation_count FROM user_invitations')
    expect(countResult.rows[0].invitation_count).toBe(0)
  })

  it.each(['owner', 'admin'])('lets the %s invite, into their own business only', async (role) => {
    const business = await createBusinessWithStaff('home')
    await createBusinessWithStaff('other')

    const response = await sendAs(business[role], { method: 'post', path: '/api/users/invitations', body: invitationBody })

    expect(response.status).toBe(201)
    const invitationResult = await pool.query('SELECT business_id, invited_by_user_id FROM user_invitations')
    expect(invitationResult.rows).toEqual([
      { business_id: business.businessId, invited_by_user_id: business[role].userId },
    ])
  })
})

describe('Conversation mode changes (Q8)', () => {
  it('lets an agent take a conversation over (mode human)', async () => {
    const business = await createBusinessWithStaff('home')
    const targets = await createTargets(business.businessId, 'home')
    await pool.query(`UPDATE conversations SET mode = 'ai' WHERE id = $1`, [targets.conversationId])

    const response = await sendAs(business.agent, {
      method: 'patch',
      path: `/api/conversations/${targets.conversationId}`,
      body: { mode: 'human' },
    })

    expect(response.status).toBe(200)
    expect(response.body.conversation.mode).toBe('human')
  })

  it('leaves the conversation unchanged when an agent tries to hand it to AI', async () => {
    const business = await createBusinessWithStaff('home')
    const targets = await createTargets(business.businessId, 'home')

    await sendAs(business.agent, {
      method: 'patch',
      path: `/api/conversations/${targets.conversationId}`,
      body: { mode: 'ai', status: 'resolved' },
    })

    const result = await pool.query('SELECT mode, status FROM conversations WHERE id = $1', [targets.conversationId])
    expect(result.rows[0]).toEqual({ mode: 'human', status: 'open' })
  })
})

describe('GET /api/users', () => {
  it('stays open to agents (agent picker)', async () => {
    const business = await createBusinessWithStaff('home')
    const response = await sendAs(business.agent, { method: 'get', path: '/api/users' })
    expect(response.status).toBe(200)
    expect(response.body.users).toHaveLength(3)
  })
})

describe('PATCH /api/users/:userId', () => {
  it('changes the role and ends every session of that staff member', async () => {
    const business = await createBusinessWithStaff('home')
    expect(await countSessionsForUser(business.agent.userId)).toBe(1)

    const response = await sendAs(business.admin, {
      method: 'patch',
      path: `/api/users/${business.agent.userId}`,
      body: { role: 'admin' },
    })

    expect(response.status).toBe(200)
    expect(response.body.user).toEqual({
      id: business.agent.userId,
      name: 'Test agent',
      email: 'agent@home.test',
      role: 'admin',
    })
    expect(await countSessionsForUser(business.agent.userId)).toBe(0)
    const revokedResponse = await sendAs(business.agent, { method: 'get', path: '/api/users' })
    expect(revokedResponse.status).toBe(401)
  })

  it('keeps the sessions when the role does not change', async () => {
    const business = await createBusinessWithStaff('home')
    const response = await sendAs(business.owner, {
      method: 'patch',
      path: `/api/users/${business.agent.userId}`,
      body: { role: 'agent' },
    })

    expect(response.status).toBe(200)
    expect(await countSessionsForUser(business.agent.userId)).toBe(1)
  })

  it("refuses to change the owner's role", async () => {
    const business = await createBusinessWithStaff('home')
    const response = await sendAs(business.admin, {
      method: 'patch',
      path: `/api/users/${business.owner.userId}`,
      body: { role: 'agent' },
    })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe("The owner's role cannot be changed.")
    expect(await countSessionsForUser(business.owner.userId)).toBe(1)
  })

  it('refuses to change your own role', async () => {
    const business = await createBusinessWithStaff('home')
    const response = await sendAs(business.admin, {
      method: 'patch',
      path: `/api/users/${business.admin.userId}`,
      body: { role: 'agent' },
    })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('You cannot change your own role.')
  })

  it.each(['owner', 'superuser', ''])('refuses the role %p with 400', async (role) => {
    const business = await createBusinessWithStaff('home')
    const response = await sendAs(business.owner, {
      method: 'patch',
      path: `/api/users/${business.agent.userId}`,
      body: { role },
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('role must be one of: admin, agent.')
  })

  it('answers 404 for a malformed or unknown id', async () => {
    const business = await createBusinessWithStaff('home')
    const malformed = await sendAs(business.owner, { method: 'patch', path: '/api/users/not-a-uuid', body: { role: 'agent' } })
    const unknown = await sendAs(business.owner, {
      method: 'patch',
      path: '/api/users/00000000-0000-4000-8000-000000000000',
      body: { role: 'agent' },
    })

    expect(malformed.status).toBe(404)
    expect(unknown.status).toBe(404)
  })
})

describe('DELETE /api/users/:userId', () => {
  it('removes the staff member, ends their sessions and unassigns their conversations', async () => {
    const business = await createBusinessWithStaff('home')
    const targets = await createTargets(business.businessId, 'home')
    await pool.query('UPDATE conversations SET assigned_agent_id = $1 WHERE id = $2', [
      business.agent.userId,
      targets.conversationId,
    ])

    const response = await sendAs(business.admin, { method: 'delete', path: `/api/users/${business.agent.userId}` })

    expect(response.status).toBe(204)
    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [business.agent.userId])
    expect(userResult.rows).toHaveLength(0)
    expect(await countSessionsForUser(business.agent.userId)).toBe(0)
    const conversationResult = await pool.query('SELECT assigned_agent_id FROM conversations WHERE id = $1', [
      targets.conversationId,
    ])
    expect(conversationResult.rows[0].assigned_agent_id).toBeNull()
    const revokedResponse = await sendAs(business.agent, { method: 'get', path: '/api/users' })
    expect(revokedResponse.status).toBe(401)
  })

  it('refuses to remove the owner', async () => {
    const business = await createBusinessWithStaff('home')
    const response = await sendAs(business.admin, { method: 'delete', path: `/api/users/${business.owner.userId}` })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('The owner cannot be removed.')
  })

  it('refuses to remove yourself', async () => {
    const business = await createBusinessWithStaff('home')
    const response = await sendAs(business.admin, { method: 'delete', path: `/api/users/${business.admin.userId}` })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('You cannot remove yourself.')
  })
})

import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { pool } from '../db/databasePool.js'
import { environmentConfig } from '../config/environmentConfig.js'
import { ApplicationError } from '../utils/applicationError.js'
import { insertBusiness, findBusinessById } from '../repositories/businessesRepository.js'
import { insertUser, findUserWithPasswordByEmail } from '../repositories/usersRepository.js'
import {
  insertSession,
  deleteSessionByTokenHash,
} from '../repositories/sessionsRepository.js'
import {
  findOpenInvitationByTokenHash,
  claimOpenInvitation,
} from '../repositories/userInvitationsRepository.js'
import { OWNER_ROLE } from '../utils/userRoles.js'
import { generateSessionToken, hashSessionToken } from './sessionTokenService.js'

const PASSWORD_HASH_COST = 12
const EMAIL_UNIQUE_CONSTRAINT_NAME = 'users_email_key'
const UNIQUE_VIOLATION_CODE = '23505'
const INVALID_CREDENTIALS_MESSAGE = 'Email or password is incorrect.'
const INVALID_INVITATION_MESSAGE = 'This invitation link is invalid, already used or expired.'

// Compared against when the email is unknown, so unknown and wrong-password cases take the same time.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing', PASSWORD_HASH_COST)

function createBusinessSlug(businessName) {
  const readableSlug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // A random suffix keeps two businesses with the same name from colliding on the unique slug.
  return `${readableSlug || 'business'}-${randomBytes(3).toString('hex')}`
}

function createWidgetKey() {
  return `wk_${randomBytes(16).toString('hex')}`
}

function toPublicUser(userRow) {
  return {
    id: userRow.id,
    businessId: userRow.business_id,
    name: userRow.name,
    email: userRow.email,
    role: userRow.role,
  }
}

async function createSessionForUser(databaseExecutor, userId) {
  const sessionToken = generateSessionToken()
  await insertSession(databaseExecutor, {
    userId,
    tokenHash: hashSessionToken(sessionToken),
    durationSeconds: environmentConfig.sessionDurationSeconds,
  })
  return sessionToken
}

// Creates the business, its owner and the first session in one transaction.
export async function signUpBusinessOwner({ businessName, name, email, password }) {
  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_COST)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const businessRow = await insertBusiness(client, {
      name: businessName,
      slug: createBusinessSlug(businessName),
      widgetKey: createWidgetKey(),
    })
    const userRow = await insertUser(client, {
      businessId: businessRow.id,
      name,
      email,
      passwordHash,
      role: OWNER_ROLE,
    })
    const sessionToken = await createSessionForUser(client, userRow.id)
    await client.query('COMMIT')

    return {
      user: toPublicUser(userRow),
      business: { id: businessRow.id, name: businessRow.name, slug: businessRow.slug },
      sessionToken,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.code === UNIQUE_VIOLATION_CODE && error.constraint === EMAIL_UNIQUE_CONSTRAINT_NAME) {
      throw new ApplicationError(409, 'An account with this email already exists.')
    }
    throw error
  } finally {
    client.release()
  }
}

// Checks the password and creates a new session. Each sign-in gets its own session row and cookie.
export async function signInUser({ email, password }) {
  const userRow = await findUserWithPasswordByEmail(pool, email)
  const passwordHashToCheck = userRow ? userRow.password_hash : DUMMY_PASSWORD_HASH
  const isPasswordValid = await bcrypt.compare(password, passwordHashToCheck)

  if (!userRow || !isPasswordValid) {
    throw new ApplicationError(401, INVALID_CREDENTIALS_MESSAGE)
  }

  const sessionToken = await createSessionForUser(pool, userRow.id)
  return {
    user: toPublicUser(userRow),
    business: { id: userRow.business_id, name: userRow.business_name, slug: userRow.business_slug },
    sessionToken,
  }
}

// Accepts a staff invitation: creates the user with the invited role in the inviting business and
// signs them in. The token works once and only until it expires. Every unusable token gets the same answer.
export async function acceptStaffInvitation({ token, name, password }) {
  const invitationTokenHash = hashSessionToken(token)

  // Checked before the slow password hash, so random tokens cannot make the server do bcrypt work.
  if (!(await findOpenInvitationByTokenHash(pool, invitationTokenHash))) {
    throw new ApplicationError(400, INVALID_INVITATION_MESSAGE)
  }
  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_COST)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    // The claim is the single-use guard: of two requests with the same token, only one gets a row.
    const invitationRow = await claimOpenInvitation(client, invitationTokenHash)
    if (!invitationRow) {
      throw new ApplicationError(400, INVALID_INVITATION_MESSAGE)
    }
    const userRow = await insertUser(client, {
      businessId: invitationRow.business_id,
      name,
      email: invitationRow.email,
      passwordHash,
      role: invitationRow.role,
    })
    const businessRow = await findBusinessById(client, invitationRow.business_id)
    const sessionToken = await createSessionForUser(client, userRow.id)
    await client.query('COMMIT')

    return {
      user: toPublicUser(userRow),
      business: { id: businessRow.id, name: businessRow.name, slug: businessRow.slug },
      sessionToken,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    // The email signed up on its own after the invitation was sent.
    if (error.code === UNIQUE_VIOLATION_CODE && error.constraint === EMAIL_UNIQUE_CONSTRAINT_NAME) {
      throw new ApplicationError(409, 'An account with this email already exists.')
    }
    throw error
  } finally {
    client.release()
  }
}

export async function signOutSession(sessionTokenHash) {
  await deleteSessionByTokenHash(pool, sessionTokenHash)
}

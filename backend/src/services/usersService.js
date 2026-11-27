import { pool } from '../db/databasePool.js'
import { environmentConfig } from '../config/environmentConfig.js'
import { ApplicationError } from '../utils/applicationError.js'
import { OWNER_ROLE } from '../utils/userRoles.js'
import {
  findUsersForBusiness,
  findUserByEmail,
  findUserInBusiness,
  updateUserRoleInBusiness,
  deleteUserInBusiness,
} from '../repositories/usersRepository.js'
import { deleteSessionsForUser } from '../repositories/sessionsRepository.js'
import {
  deleteOpenInvitationForEmail,
  insertInvitation,
} from '../repositories/userInvitationsRepository.js'
import { generateSessionToken, hashSessionToken } from './sessionTokenService.js'
import { getInvitationMailer } from './invitationMailService.js'

const UNIQUE_VIOLATION_CODE = '23505'
const STAFF_MEMBER_NOT_FOUND_MESSAGE = 'Staff member not found.'

function toPublicStaffMember(userRow) {
  return { id: userRow.id, name: userRow.name, email: userRow.email, role: userRow.role }
}

function toPublicInvitation(invitationRow) {
  return {
    id: invitationRow.id,
    email: invitationRow.email,
    role: invitationRow.role,
    invitedByUserId: invitationRow.invited_by_user_id,
    createdAt: invitationRow.created_at,
    expiresAt: invitationRow.expires_at,
  }
}

// The token travels in the URL fragment (#), which browsers never send to servers or in Referer headers.
function buildInvitationLink(invitationToken) {
  return `${environmentConfig.staffAppBaseUrl}/accept-invitation#token=${invitationToken}`
}

async function runInTransaction(work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Staff are listed for the agent picker. Only members of the caller's business are returned.
export async function listStaffForBusiness({ businessId }) {
  const userRows = await findUsersForBusiness(pool, { businessId })
  return userRows.map(toPublicStaffMember)
}

// Creates a single-use, expiring invitation. Only the token's hash is stored.
// Each staff member belongs to one business (Q1), so an email that already has an account is refused.
export async function inviteStaffMember({ business, inviter, email, role }) {
  const existingUserRow = await findUserByEmail(pool, email)
  if (existingUserRow?.business_id === business.id) {
    throw new ApplicationError(409, 'This person is already a staff member of your business.')
  }
  if (existingUserRow) {
    throw new ApplicationError(
      409,
      'This email already belongs to a staff member of another business. A person can belong to one business only, so ask them for a different email.',
    )
  }

  const invitationToken = generateSessionToken()
  let invitationRow
  try {
    invitationRow = await runInTransaction(async (client) => {
      await deleteOpenInvitationForEmail(client, { businessId: business.id, email })
      return insertInvitation(client, {
        businessId: business.id,
        email,
        role,
        tokenHash: hashSessionToken(invitationToken),
        invitedByUserId: inviter.id,
        durationSeconds: environmentConfig.invitationDurationSeconds,
      })
    })
  } catch (error) {
    // Two invitations for the same email at the same moment: the unique index lets only one through.
    if (error.code === UNIQUE_VIOLATION_CODE) {
      throw new ApplicationError(409, 'An invitation for this email was just created. Please try again.')
    }
    throw error
  }

  const invitationLink = buildInvitationLink(invitationToken)
  const delivery = await getInvitationMailer().deliverInvitation({
    email,
    role,
    invitationLink,
    businessName: business.name,
    inviterName: inviter.name,
  })

  return {
    invitation: toPublicInvitation(invitationRow),
    invitationLink: delivery.isLinkReturnedToInviter ? invitationLink : undefined,
  }
}

// Changes another staff member's role and ends all their sessions, so the new role applies at once.
// The owner's role and your own role cannot be changed here.
export async function changeStaffMemberRole({ businessId, actingUserId, userId, role }) {
  if (userId === actingUserId) {
    throw new ApplicationError(403, 'You cannot change your own role.')
  }

  return runInTransaction(async (client) => {
    const targetUserRow = await findUserInBusiness(client, { businessId, userId })
    if (!targetUserRow) {
      throw new ApplicationError(404, STAFF_MEMBER_NOT_FOUND_MESSAGE)
    }
    if (targetUserRow.role === OWNER_ROLE) {
      throw new ApplicationError(403, "The owner's role cannot be changed.")
    }
    if (targetUserRow.role === role) {
      return toPublicStaffMember(targetUserRow)
    }

    // The WHERE clause also refuses the owner, in case the role changed since the read above.
    const updatedUserRow = await updateUserRoleInBusiness(client, { businessId, userId, role })
    if (!updatedUserRow) {
      throw new ApplicationError(404, STAFF_MEMBER_NOT_FOUND_MESSAGE)
    }
    await deleteSessionsForUser(client, userId)
    return toPublicStaffMember(updatedUserRow)
  })
}

// Removes another staff member. Their sessions are deleted with them (ON DELETE CASCADE).
// The owner and yourself cannot be removed.
export async function removeStaffMember({ businessId, actingUserId, userId }) {
  if (userId === actingUserId) {
    throw new ApplicationError(403, 'You cannot remove yourself.')
  }

  const targetUserRow = await findUserInBusiness(pool, { businessId, userId })
  if (!targetUserRow) {
    throw new ApplicationError(404, STAFF_MEMBER_NOT_FOUND_MESSAGE)
  }
  if (targetUserRow.role === OWNER_ROLE) {
    throw new ApplicationError(403, 'The owner cannot be removed.')
  }

  const deletedCount = await deleteUserInBusiness(pool, { businessId, userId })
  if (deletedCount === 0) {
    throw new ApplicationError(404, STAFF_MEMBER_NOT_FOUND_MESSAGE)
  }
}

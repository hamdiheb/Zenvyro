import { pool } from '../db/databasePool.js'
import { findUsersForBusiness } from '../repositories/usersRepository.js'

function toPublicStaffMember(userRow) {
  return { id: userRow.id, name: userRow.name, email: userRow.email, role: userRow.role }
}

// Staff are listed for the agent picker. Only members of the caller's business are returned.
export async function listStaffForBusiness({ businessId }) {
  const userRows = await findUsersForBusiness(pool, { businessId })
  return userRows.map(toPublicStaffMember)
}

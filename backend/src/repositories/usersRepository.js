// SQL for the users table. The executor is either the pool or a transaction client.
// password_hash is only selected where sign-in needs it; it is never returned to the client.
// Sign-up inserts the owner; accepting an invitation inserts an admin or agent.
export async function insertUser(databaseExecutor, { businessId, name, email, passwordHash, role }) {
  const result = await databaseExecutor.query(
    `INSERT INTO users (business_id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, business_id, name, email, role, created_at`,
    [businessId, name, email, passwordHash, role],
  )
  return result.rows[0]
}

// Emails are globally unique (one business per staff member), so this finds at most one user.
export async function findUserByEmail(databaseExecutor, email) {
  const result = await databaseExecutor.query(
    `SELECT id, business_id, role FROM users WHERE email = $1`,
    [email],
  )
  return result.rows[0] ?? null
}

// Changes a staff member's role inside one business. The owner row is never changed here.
// Returns the updated row, or null when no non-owner user with this id exists in the business.
export async function updateUserRoleInBusiness(databaseExecutor, { businessId, userId, role }) {
  const result = await databaseExecutor.query(
    `UPDATE users
     SET role = $3
     WHERE id = $1 AND business_id = $2 AND role <> 'owner'
     RETURNING id, name, email, role`,
    [userId, businessId, role],
  )
  return result.rows[0] ?? null
}

// Removes a staff member from one business. Their sessions go with them (ON DELETE CASCADE);
// conversations they were assigned become unassigned (ON DELETE SET NULL). The owner is never removed.
export async function deleteUserInBusiness(databaseExecutor, { businessId, userId }) {
  const result = await databaseExecutor.query(
    `DELETE FROM users WHERE id = $1 AND business_id = $2 AND role <> 'owner'`,
    [userId, businessId],
  )
  return result.rowCount
}

export async function findUserWithPasswordByEmail(databaseExecutor, email) {
  const result = await databaseExecutor.query(
    `SELECT users.id, users.business_id, users.name, users.email, users.role, users.password_hash,
            businesses.name AS business_name, businesses.slug AS business_slug
     FROM users
     JOIN businesses ON businesses.id = users.business_id
     WHERE users.email = $1`,
    [email],
  )
  return result.rows[0] ?? null
}

// Confirms a staff id belongs to this business, so a conversation can only be assigned inside it.
export async function findUserInBusiness(databaseExecutor, { businessId, userId }) {
  const result = await databaseExecutor.query(
    `SELECT id, business_id, name, email, role
     FROM users
     WHERE id = $1 AND business_id = $2`,
    [userId, businessId],
  )
  return result.rows[0] ?? null
}

// Lists every staff member of a business, by name. Never selects password_hash.
export async function findUsersForBusiness(databaseExecutor, { businessId }) {
  const result = await databaseExecutor.query(
    `SELECT id, name, email, role
     FROM users
     WHERE business_id = $1
     ORDER BY name, id`,
    [businessId],
  )
  return result.rows
}

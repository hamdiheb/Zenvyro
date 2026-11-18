// SQL for the users table. The executor is either the pool or a transaction client.
// password_hash is only selected where sign-in needs it; it is never returned to the client.
export async function insertOwnerUser(databaseExecutor, { businessId, name, email, passwordHash }) {
  const result = await databaseExecutor.query(
    `INSERT INTO users (business_id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'owner')
     RETURNING id, business_id, name, email, role, created_at`,
    [businessId, name, email, passwordHash],
  )
  return result.rows[0]
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

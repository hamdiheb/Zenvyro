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
    `SELECT id, business_id, name, email, role, password_hash
     FROM users
     WHERE email = $1`,
    [email],
  )
  return result.rows[0] ?? null
}

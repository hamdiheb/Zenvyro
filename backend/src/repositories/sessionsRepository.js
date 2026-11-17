// SQL for the sessions table. Only token_hash (SHA-256 hex) is stored, never the raw cookie value.
// The executor is either the pool or a transaction client.

export async function insertSession(databaseExecutor, { userId, tokenHash, durationSeconds }) {
  const result = await databaseExecutor.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(secs => $3))
     RETURNING id, user_id, expires_at`,
    [userId, tokenHash, durationSeconds],
  )
  return result.rows[0]
}

// Returns the user behind a session only while that session has not expired.
export async function findLiveSessionByTokenHash(databaseExecutor, tokenHash) {
  const result = await databaseExecutor.query(
    `SELECT sessions.id AS session_id,
            users.id,
            users.business_id,
            users.name,
            users.email,
            users.role
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1
       AND sessions.expires_at > now()`,
    [tokenHash],
  )
  return result.rows[0] ?? null
}

export async function deleteSessionByTokenHash(databaseExecutor, tokenHash) {
  const result = await databaseExecutor.query(
    `DELETE FROM sessions WHERE token_hash = $1`,
    [tokenHash],
  )
  return result.rowCount
}

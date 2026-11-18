// SQL for the widget_sessions table. The executor is either the pool or a transaction client.
// Only token_hash (SHA-256 hex) is stored, never the raw token the widget keeps.

export async function insertWidgetSession(
  databaseExecutor,
  { businessId, customerId, conversationId, tokenHash, durationSeconds },
) {
  const result = await databaseExecutor.query(
    `INSERT INTO widget_sessions (business_id, customer_id, conversation_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5))
     RETURNING id`,
    [businessId, customerId, conversationId, tokenHash, durationSeconds],
  )
  return result.rows[0]
}

// Returns the widget visitor, with the business's display name, only while the session has not expired.
export async function findLiveWidgetSessionByTokenHash(databaseExecutor, tokenHash) {
  const result = await databaseExecutor.query(
    `SELECT widget_sessions.id,
            widget_sessions.business_id,
            widget_sessions.customer_id,
            widget_sessions.conversation_id,
            businesses.name AS business_name
     FROM widget_sessions
     JOIN businesses ON businesses.id = widget_sessions.business_id
     WHERE widget_sessions.token_hash = $1
       AND widget_sessions.expires_at > now()`,
    [tokenHash],
  )
  return result.rows[0] ?? null
}

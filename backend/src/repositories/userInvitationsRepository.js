// SQL for the user_invitations table. Only token_hash (SHA-256 hex) is stored, never the raw token.
// The executor is either the pool or a transaction client.

// Removes the open invitation for this email in this business, so a re-invite replaces it.
export async function deleteOpenInvitationForEmail(databaseExecutor, { businessId, email }) {
  await databaseExecutor.query(
    `DELETE FROM user_invitations
     WHERE business_id = $1 AND email = $2 AND accepted_at IS NULL`,
    [businessId, email],
  )
}

export async function insertInvitation(
  databaseExecutor,
  { businessId, email, role, tokenHash, invitedByUserId, durationSeconds },
) {
  const result = await databaseExecutor.query(
    `INSERT INTO user_invitations (business_id, email, role, token_hash, invited_by_user_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(secs => $6))
     RETURNING id, business_id, email, role, invited_by_user_id, created_at, expires_at`,
    [businessId, email, role, tokenHash, invitedByUserId, durationSeconds],
  )
  return result.rows[0]
}

// Read-only check that a token can still be accepted. Accepting is decided by claimOpenInvitation.
export async function findOpenInvitationByTokenHash(databaseExecutor, tokenHash) {
  const result = await databaseExecutor.query(
    `SELECT id FROM user_invitations
     WHERE token_hash = $1 AND accepted_at IS NULL AND expires_at > now()`,
    [tokenHash],
  )
  return result.rows[0] ?? null
}

// Marks the invitation accepted in one statement, so two requests with the same token cannot both win.
// Returns null when the token is unknown, already used or expired.
export async function claimOpenInvitation(databaseExecutor, tokenHash) {
  const result = await databaseExecutor.query(
    `UPDATE user_invitations
     SET accepted_at = now()
     WHERE token_hash = $1 AND accepted_at IS NULL AND expires_at > now()
     RETURNING id, business_id, email, role`,
    [tokenHash],
  )
  return result.rows[0] ?? null
}

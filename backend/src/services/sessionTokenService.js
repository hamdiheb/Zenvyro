import { createHash, randomBytes } from 'node:crypto'

// The raw token goes only into the HttpOnly cookie. The database keeps only its hash.
export function generateSessionToken() {
  return randomBytes(32).toString('base64url')
}

// 64 lowercase hex characters, matching the CHECK constraint on sessions.token_hash.
export function hashSessionToken(sessionToken) {
  return createHash('sha256').update(sessionToken).digest('hex')
}

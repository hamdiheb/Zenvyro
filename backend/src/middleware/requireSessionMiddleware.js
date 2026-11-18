import { environmentConfig } from '../config/environmentConfig.js'
import { pool } from '../db/databasePool.js'
import { ApplicationError } from '../utils/applicationError.js'
import { findLiveSessionByTokenHash } from '../repositories/sessionsRepository.js'
import { hashSessionToken } from '../services/sessionTokenService.js'

// Checks the session cookie against a live row in the sessions table (not expired).
// On success it sets request.authenticatedUser, request.authenticatedBusiness and request.sessionTokenHash
// for the controller.
export async function requireSessionMiddleware(request, response, nextFunction) {
  const sessionToken = request.cookies?.[environmentConfig.sessionCookieName]

  if (!sessionToken) {
    return nextFunction(new ApplicationError(401, 'You must be signed in.'))
  }

  const sessionTokenHash = hashSessionToken(sessionToken)
  const sessionRow = await findLiveSessionByTokenHash(pool, sessionTokenHash)

  if (!sessionRow) {
    // The cookie points at a session that is gone or expired, so remove it from the browser too.
    response.clearCookie(environmentConfig.sessionCookieName, { path: '/' })
    return nextFunction(new ApplicationError(401, 'Your session has ended. Please sign in again.'))
  }

  request.authenticatedUser = {
    id: sessionRow.id,
    businessId: sessionRow.business_id,
    name: sessionRow.name,
    email: sessionRow.email,
    role: sessionRow.role,
  }
  request.authenticatedBusiness = {
    id: sessionRow.business_id,
    name: sessionRow.business_name,
    slug: sessionRow.business_slug,
  }
  request.sessionTokenHash = sessionTokenHash
  return nextFunction()
}

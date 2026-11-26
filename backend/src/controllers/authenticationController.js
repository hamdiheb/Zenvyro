import { environmentConfig } from '../config/environmentConfig.js'
import {
  signUpBusinessOwner,
  signInUser,
  signOutSession,
  acceptStaffInvitation,
} from '../services/authenticationService.js'

function buildSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: environmentConfig.isCookieSecure,
    path: '/',
    maxAge: environmentConfig.sessionDurationMilliseconds,
  }
}

function setSessionCookie(response, sessionToken) {
  response.cookie(environmentConfig.sessionCookieName, sessionToken, buildSessionCookieOptions())
}

export async function signUp(request, response) {
  const { user, business, sessionToken } = await signUpBusinessOwner(request.validatedBody)
  setSessionCookie(response, sessionToken)
  response.status(201).json({ user, business })
}

export async function signIn(request, response) {
  const { user, business, sessionToken } = await signInUser(request.validatedBody)
  setSessionCookie(response, sessionToken)
  response.status(200).json({ user, business })
}

// Creates the invited staff member and signs them in, like sign-up does for an owner.
export async function acceptInvitation(request, response) {
  const { user, business, sessionToken } = await acceptStaffInvitation(request.validatedBody)
  setSessionCookie(response, sessionToken)
  response.status(201).json({ user, business })
}

export function getCurrentUser(request, response) {
  response.status(200).json({ user: request.authenticatedUser, business: request.authenticatedBusiness })
}

export async function signOut(request, response) {
  await signOutSession(request.sessionTokenHash)
  response.clearCookie(environmentConfig.sessionCookieName, { path: '/' })
  response.status(204).end()
}

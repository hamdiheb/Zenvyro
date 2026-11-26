import { ApplicationError } from '../utils/applicationError.js'

export const FORBIDDEN_MESSAGE = 'You do not have permission to do this.'

// Builds a middleware that lets the request through only when the signed-in user has one of allowedRoles.
// Place it after requireSessionMiddleware, which sets request.authenticatedUser.
// Usage: router.post('/path', requireRoleMiddleware(STAFF_MANAGER_ROLES), handler)
export function requireRoleMiddleware(allowedRoles) {
  return function checkRole(request, _response, nextFunction) {
    const role = request.authenticatedUser?.role
    if (!allowedRoles.includes(role)) {
      return nextFunction(new ApplicationError(403, FORBIDDEN_MESSAGE))
    }
    return nextFunction()
  }
}

import { ApplicationError } from '../utils/applicationError.js'
import { STAFF_MANAGER_ROLES } from '../utils/userRoles.js'
import { FORBIDDEN_MESSAGE } from './requireRoleMiddleware.js'

// Handing a conversation back to AI (mode 'ai') decides who answers the customer, so only owners and
// admins may do it until a per-business setting exists (Q8). Any staff member may take over (mode 'human').
// Place it after validateUpdateConversationMiddleware, which sets request.validatedBody.
export function requireRoleToHandBackToAiMiddleware(request, _response, nextFunction) {
  const isHandBackToAi = request.validatedBody?.mode === 'ai'
  if (isHandBackToAi && !STAFF_MANAGER_ROLES.includes(request.authenticatedUser?.role)) {
    return nextFunction(new ApplicationError(403, FORBIDDEN_MESSAGE))
  }
  return nextFunction()
}

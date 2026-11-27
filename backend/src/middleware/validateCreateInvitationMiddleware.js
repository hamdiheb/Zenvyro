import { ApplicationError } from '../utils/applicationError.js'
import { readBodyText, isValidEmail } from '../utils/inputValidation.js'
import { ASSIGNABLE_ROLES } from '../utils/userRoles.js'

// Body: { email, role }. The role is admin or agent; the owner cannot be invited.
export function validateCreateInvitationMiddleware(request, _response, nextFunction) {
  const invitationFields = {
    email: readBodyText(request.body, 'email').trim().toLowerCase(),
    role: readBodyText(request.body, 'role'),
  }

  if (!isValidEmail(invitationFields.email)) {
    return nextFunction(new ApplicationError(400, 'A valid email is required.'))
  }
  if (!ASSIGNABLE_ROLES.includes(invitationFields.role)) {
    return nextFunction(new ApplicationError(400, `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}.`))
  }

  request.validatedBody = invitationFields
  return nextFunction()
}

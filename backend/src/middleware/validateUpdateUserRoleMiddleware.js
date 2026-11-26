import { ApplicationError } from '../utils/applicationError.js'
import { readBodyText } from '../utils/inputValidation.js'
import { ASSIGNABLE_ROLES } from '../utils/userRoles.js'

// Body: { role }, admin or agent. Nobody can be made owner here.
export function validateUpdateUserRoleMiddleware(request, _response, nextFunction) {
  const role = readBodyText(request.body, 'role')
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return nextFunction(new ApplicationError(400, `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}.`))
  }
  request.validatedBody = { role }
  return nextFunction()
}

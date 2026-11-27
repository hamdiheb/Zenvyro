import { ApplicationError } from '../utils/applicationError.js'
import { isValidUuid } from '../utils/inputValidation.js'

// A malformed id can never match a row, so it reads as "not found" rather than a database error.
export function validateUserIdMiddleware(request, _response, nextFunction) {
  if (!isValidUuid(request.params.userId)) {
    return nextFunction(new ApplicationError(404, 'Staff member not found.'))
  }
  return nextFunction()
}

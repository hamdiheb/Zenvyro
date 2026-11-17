import { ApplicationError } from '../utils/applicationError.js'
import { readBodyText, isValidEmail } from '../utils/inputValidation.js'

const PASSWORD_MAXIMUM_LENGTH = 72

export function validateSignInMiddleware(request, _response, nextFunction) {
  const signInFields = {
    email: readBodyText(request.body, 'email').trim().toLowerCase(),
    password: readBodyText(request.body, 'password'),
  }

  if (!isValidEmail(signInFields.email)) {
    return nextFunction(new ApplicationError(400, 'A valid email is required.'))
  }
  if (signInFields.password.length === 0) {
    return nextFunction(new ApplicationError(400, 'Password is required.'))
  }
  if (signInFields.password.length > PASSWORD_MAXIMUM_LENGTH) {
    return nextFunction(new ApplicationError(400, 'Password must be at most 72 characters.'))
  }

  request.validatedBody = signInFields
  return nextFunction()
}

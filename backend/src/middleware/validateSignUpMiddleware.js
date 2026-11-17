import { ApplicationError } from '../utils/applicationError.js'
import { readBodyText, isValidEmail } from '../utils/inputValidation.js'

const BUSINESS_NAME_MINIMUM_LENGTH = 2
const BUSINESS_NAME_MAXIMUM_LENGTH = 120
const NAME_MAXIMUM_LENGTH = 120
const PASSWORD_MINIMUM_LENGTH = 8
// bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of silently truncated.
const PASSWORD_MAXIMUM_LENGTH = 72

function findSignUpProblem({ businessName, name, email, password }) {
  if (businessName.length < BUSINESS_NAME_MINIMUM_LENGTH) {
    return 'Business name must be at least 2 characters.'
  }
  if (businessName.length > BUSINESS_NAME_MAXIMUM_LENGTH) {
    return 'Business name must be at most 120 characters.'
  }
  if (name.length === 0) {
    return 'Name is required.'
  }
  if (name.length > NAME_MAXIMUM_LENGTH) {
    return 'Name must be at most 120 characters.'
  }
  if (!isValidEmail(email)) {
    return 'A valid email is required.'
  }
  if (password.length < PASSWORD_MINIMUM_LENGTH) {
    return 'Password must be at least 8 characters.'
  }
  if (password.length > PASSWORD_MAXIMUM_LENGTH) {
    return 'Password must be at most 72 characters.'
  }
  return null
}

export function validateSignUpMiddleware(request, _response, nextFunction) {
  const signUpFields = {
    businessName: readBodyText(request.body, 'businessName').trim(),
    name: readBodyText(request.body, 'name').trim(),
    email: readBodyText(request.body, 'email').trim().toLowerCase(),
    // The password is not trimmed: leading and trailing spaces are part of it.
    password: readBodyText(request.body, 'password'),
  }

  const problemMessage = findSignUpProblem(signUpFields)
  if (problemMessage) {
    return nextFunction(new ApplicationError(400, problemMessage))
  }
  request.validatedBody = signUpFields
  return nextFunction()
}

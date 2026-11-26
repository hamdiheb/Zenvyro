import { ApplicationError } from '../utils/applicationError.js'
import { readBodyText } from '../utils/inputValidation.js'

// Invitation tokens are 43 base64url characters; anything far longer is not worth hashing.
const TOKEN_MAXIMUM_LENGTH = 128
const NAME_MAXIMUM_LENGTH = 120
const PASSWORD_MINIMUM_LENGTH = 8
// bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of silently truncated.
const PASSWORD_MAXIMUM_LENGTH = 72

function findAcceptInvitationProblem({ token, name, password }) {
  if (token.length === 0 || token.length > TOKEN_MAXIMUM_LENGTH) {
    return 'A valid invitation token is required.'
  }
  if (name.length === 0) {
    return 'Name is required.'
  }
  if (name.length > NAME_MAXIMUM_LENGTH) {
    return 'Name must be at most 120 characters.'
  }
  if (password.length < PASSWORD_MINIMUM_LENGTH) {
    return 'Password must be at least 8 characters.'
  }
  if (password.length > PASSWORD_MAXIMUM_LENGTH) {
    return 'Password must be at most 72 characters.'
  }
  return null
}

// Body: { token, name, password }. The email and role come from the invitation, never from the body.
export function validateAcceptInvitationMiddleware(request, _response, nextFunction) {
  const acceptFields = {
    token: readBodyText(request.body, 'token').trim(),
    name: readBodyText(request.body, 'name').trim(),
    // The password is not trimmed: leading and trailing spaces are part of it.
    password: readBodyText(request.body, 'password'),
  }

  const problemMessage = findAcceptInvitationProblem(acceptFields)
  if (problemMessage) {
    return nextFunction(new ApplicationError(400, problemMessage))
  }
  request.validatedBody = acceptFields
  return nextFunction()
}

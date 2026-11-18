// Mirrors backend/src/middleware/validateSignUpMiddleware.js so most mistakes are caught before a request.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MINIMUM_LENGTH = 8
const PASSWORD_MAXIMUM_LENGTH = 72
const BUSINESS_NAME_MINIMUM_LENGTH = 2
const TEXT_MAXIMUM_LENGTH = 120

export function findSignInFieldErrors({ email, password }) {
  const fieldErrors = {}
  if (!EMAIL_PATTERN.test(email.trim())) {
    fieldErrors.email = 'Enter a valid email.'
  }
  if (!password) {
    fieldErrors.password = 'Enter your password.'
  }
  return fieldErrors
}

export function findSignUpFieldErrors({ businessName, name, email, password }) {
  const fieldErrors = {}
  const trimmedBusinessName = businessName.trim()
  if (trimmedBusinessName.length < BUSINESS_NAME_MINIMUM_LENGTH) {
    fieldErrors.businessName = 'Business name must be at least 2 characters.'
  } else if (trimmedBusinessName.length > TEXT_MAXIMUM_LENGTH) {
    fieldErrors.businessName = 'Business name must be at most 120 characters.'
  }
  if (!name.trim()) {
    fieldErrors.name = 'Enter your name.'
  } else if (name.trim().length > TEXT_MAXIMUM_LENGTH) {
    fieldErrors.name = 'Name must be at most 120 characters.'
  }
  if (!EMAIL_PATTERN.test(email.trim())) {
    fieldErrors.email = 'Enter a valid email.'
  }
  if (password.length < PASSWORD_MINIMUM_LENGTH) {
    fieldErrors.password = 'Password must be at least 8 characters.'
  } else if (password.length > PASSWORD_MAXIMUM_LENGTH) {
    fieldErrors.password = 'Password must be at most 72 characters.'
  }
  return fieldErrors
}

// The API returns one message per error. Show it under the field it is about, or above the button.
export function placeServerError(serverMessage) {
  const lowerCaseMessage = serverMessage.toLowerCase()
  if (lowerCaseMessage.startsWith('business name')) {
    return { businessName: serverMessage }
  }
  if (lowerCaseMessage.startsWith('name')) {
    return { name: serverMessage }
  }
  if (lowerCaseMessage.includes('email') && !lowerCaseMessage.includes('password')) {
    return { email: serverMessage }
  }
  if (lowerCaseMessage.startsWith('password')) {
    return { password: serverMessage }
  }
  return { form: serverMessage }
}

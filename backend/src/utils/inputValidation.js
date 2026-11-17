// Plain checks for request bodies. A field that is missing or not a string reads as ''.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function readBodyText(requestBody, fieldName) {
  const value = requestBody?.[fieldName]
  return typeof value === 'string' ? value : ''
}

export function isValidEmail(email) {
  return email.length <= 254 && EMAIL_PATTERN.test(email)
}

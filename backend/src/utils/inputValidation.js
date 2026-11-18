// Plain checks for request bodies. A field that is missing or not a string reads as ''.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function readBodyText(requestBody, fieldName) {
  const value = requestBody?.[fieldName]
  return typeof value === 'string' ? value : ''
}

export function isValidEmail(email) {
  return email.length <= 254 && EMAIL_PATTERN.test(email)
}

export function isValidUuid(text) {
  return UUID_PATTERN.test(text)
}

// Reads one query-string value. Returns undefined when absent, the trimmed text when it is a
// single string, and null when the parameter was repeated or is not a plain string.
export function readQueryText(queryParameters, parameterName) {
  const value = queryParameters?.[parameterName]
  if (value === undefined) {
    return undefined
  }
  return typeof value === 'string' ? value.trim() : null
}

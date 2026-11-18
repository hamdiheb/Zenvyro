// Thin fetch wrapper. Staff requests send the HttpOnly session cookie (credentials: 'include').
// Every failed response becomes one ApiRequestError carrying the HTTP status and the server's message.
const FALLBACK_ERROR_MESSAGE = 'Something went wrong. Please try again.'
const NETWORK_ERROR_MESSAGE = 'Cannot reach the server. Check your connection and try again.'

export class ApiRequestError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.name = 'ApiRequestError'
    this.statusCode = statusCode
  }
}

async function readResponseJson(response) {
  if (response.status === 204) {
    return null
  }
  const responseText = await response.text()
  if (!responseText) {
    return null
  }
  try {
    return JSON.parse(responseText)
  } catch {
    return null
  }
}

export async function requestJson(path, { method = 'GET', body, headers = {}, credentials = 'include' } = {}) {
  const requestHeaders = { Accept: 'application/json', ...headers }
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(path, {
      method,
      credentials,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiRequestError(0, NETWORK_ERROR_MESSAGE)
  }

  const responseBody = await readResponseJson(response)
  if (!response.ok) {
    throw new ApiRequestError(response.status, responseBody?.error || FALLBACK_ERROR_MESSAGE)
  }
  return responseBody
}

export function buildQueryString(queryValues) {
  const searchParameters = new URLSearchParams()
  Object.entries(queryValues).forEach(([parameterName, parameterValue]) => {
    if (parameterValue !== null && parameterValue !== undefined && parameterValue !== '') {
      searchParameters.set(parameterName, String(parameterValue))
    }
  })
  const queryText = searchParameters.toString()
  return queryText ? `?${queryText}` : ''
}

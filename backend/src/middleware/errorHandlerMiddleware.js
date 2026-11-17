import { ApplicationError } from '../utils/applicationError.js'

// Turns expected errors into JSON with their status code. Anything else becomes a generic 500,
// so internal details (SQL text, stack traces) never reach the client.
// Express identifies this as an error handler by its four-argument signature.
export function errorHandlerMiddleware(error, _request, response, _nextFunction) {
  if (error instanceof ApplicationError) {
    return response.status(error.statusCode).json({ error: error.message })
  }

  // Malformed JSON bodies come from express.json() with a 4xx status and a safe message.
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'Request body must be valid JSON.' })
  }

  console.error('Unhandled error:', error.message)
  return response.status(500).json({ error: 'Something went wrong. Please try again.' })
}

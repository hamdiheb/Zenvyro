import { ApplicationError } from '../utils/applicationError.js'
import { readQueryText } from '../utils/inputValidation.js'
import { decodePaginationCursor, readPageLimit } from '../utils/paginationCursor.js'

// Reads limit and cursor for the message history into request.validatedQuery.
export function validateListMessagesMiddleware(request, _response, nextFunction) {
  try {
    const limitText = readQueryText(request.query, 'limit')
    const cursorText = readQueryText(request.query, 'cursor')

    if (limitText === null || cursorText === null) {
      return nextFunction(new ApplicationError(400, 'Each query parameter may appear only once.'))
    }

    request.validatedQuery = {
      limit: readPageLimit(limitText),
      cursor: cursorText ? decodePaginationCursor(cursorText) : null,
    }
    return nextFunction()
  } catch (error) {
    return nextFunction(error)
  }
}

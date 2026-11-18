import { ApplicationError } from '../utils/applicationError.js'
import { isValidUuid, readQueryText } from '../utils/inputValidation.js'
import { decodePaginationCursor, readPageLimit } from '../utils/paginationCursor.js'
import {
  CONVERSATION_STATUSES,
  CONVERSATION_MODES,
  CONVERSATION_LIST_VIEWS,
} from '../utils/conversationValues.js'

const REPEATED_PARAMETER_MESSAGE = 'Each query parameter may appear only once.'

// Reads the list filters from the query string into request.validatedQuery.
export function validateListConversationsMiddleware(request, _response, nextFunction) {
  try {
    const queryParameters = request.query
    const viewText = readQueryText(queryParameters, 'view')
    const statusText = readQueryText(queryParameters, 'status')
    const modeText = readQueryText(queryParameters, 'mode')
    const customerIdText = readQueryText(queryParameters, 'customerId')
    const limitText = readQueryText(queryParameters, 'limit')
    const cursorText = readQueryText(queryParameters, 'cursor')

    const hasRepeatedParameter = [viewText, statusText, modeText, customerIdText, limitText, cursorText].includes(null)
    if (hasRepeatedParameter) {
      return nextFunction(new ApplicationError(400, REPEATED_PARAMETER_MESSAGE))
    }

    const view = viewText || 'all'
    if (!CONVERSATION_LIST_VIEWS.includes(view)) {
      return nextFunction(new ApplicationError(400, `view must be one of: ${CONVERSATION_LIST_VIEWS.join(', ')}.`))
    }
    if (statusText && !CONVERSATION_STATUSES.includes(statusText)) {
      return nextFunction(new ApplicationError(400, `status must be one of: ${CONVERSATION_STATUSES.join(', ')}.`))
    }
    if (modeText && !CONVERSATION_MODES.includes(modeText)) {
      return nextFunction(new ApplicationError(400, `mode must be one of: ${CONVERSATION_MODES.join(', ')}.`))
    }
    if (customerIdText && !isValidUuid(customerIdText)) {
      return nextFunction(new ApplicationError(400, 'customerId must be a valid id.'))
    }

    request.validatedQuery = {
      view,
      status: statusText || null,
      mode: modeText || null,
      customerId: customerIdText || null,
      limit: readPageLimit(limitText),
      cursor: cursorText ? decodePaginationCursor(cursorText) : null,
    }
    return nextFunction()
  } catch (error) {
    return nextFunction(error)
  }
}

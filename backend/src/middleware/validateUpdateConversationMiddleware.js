import { ApplicationError } from '../utils/applicationError.js'
import { readBodyText } from '../utils/inputValidation.js'
import { CONVERSATION_STATUSES, CONVERSATION_MODES } from '../utils/conversationValues.js'

// Accepts status and/or mode. At least one must be given; anything else is rejected.
export function validateUpdateConversationMiddleware(request, _response, nextFunction) {
  const requestBody = request.body ?? {}
  const changes = {}

  if (requestBody.status !== undefined) {
    const statusText = readBodyText(requestBody, 'status')
    if (!CONVERSATION_STATUSES.includes(statusText)) {
      return nextFunction(new ApplicationError(400, `status must be one of: ${CONVERSATION_STATUSES.join(', ')}.`))
    }
    changes.status = statusText
  }

  if (requestBody.mode !== undefined) {
    const modeText = readBodyText(requestBody, 'mode')
    if (!CONVERSATION_MODES.includes(modeText)) {
      return nextFunction(new ApplicationError(400, `mode must be one of: ${CONVERSATION_MODES.join(', ')}.`))
    }
    changes.mode = modeText
  }

  if (Object.keys(changes).length === 0) {
    return nextFunction(new ApplicationError(400, 'Give status or mode to change.'))
  }

  request.validatedBody = changes
  return nextFunction()
}

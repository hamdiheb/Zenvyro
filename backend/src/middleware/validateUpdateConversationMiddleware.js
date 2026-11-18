import { ApplicationError } from '../utils/applicationError.js'
import { readBodyText, isValidUuid } from '../utils/inputValidation.js'
import { CONVERSATION_STATUSES, CONVERSATION_MODES } from '../utils/conversationValues.js'

// Accepts status, mode and/or assignedAgentId (a staff id, or null to unassign). At least one must be given.
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

  if (requestBody.assignedAgentId !== undefined) {
    if (requestBody.assignedAgentId === null) {
      changes.assignedAgentId = null
    } else if (typeof requestBody.assignedAgentId === 'string' && isValidUuid(requestBody.assignedAgentId)) {
      changes.assignedAgentId = requestBody.assignedAgentId
    } else {
      return nextFunction(new ApplicationError(400, 'assignedAgentId must be a staff id or null.'))
    }
  }

  if (Object.keys(changes).length === 0) {
    return nextFunction(new ApplicationError(400, 'Give status, mode or assignedAgentId to change.'))
  }

  request.validatedBody = changes
  return nextFunction()
}

import { ApplicationError } from '../utils/applicationError.js'
import { isValidUuid } from '../utils/inputValidation.js'

const MAXIMUM_LABELS_PER_CONVERSATION = 20

// labelIds replaces the conversation's whole label set. An empty array removes every label.
export function validateSetConversationLabelsMiddleware(request, _response, nextFunction) {
  const labelIds = request.body?.labelIds
  if (!Array.isArray(labelIds) || labelIds.length > MAXIMUM_LABELS_PER_CONVERSATION) {
    return nextFunction(
      new ApplicationError(400, `labelIds must be an array of up to ${MAXIMUM_LABELS_PER_CONVERSATION} label ids.`),
    )
  }
  const uniqueLabelIds = [...new Set(labelIds)]
  if (!uniqueLabelIds.every((labelId) => typeof labelId === 'string' && isValidUuid(labelId))) {
    return nextFunction(new ApplicationError(400, 'Every labelIds entry must be a valid id.'))
  }

  request.validatedBody = { labelIds: uniqueLabelIds }
  return nextFunction()
}

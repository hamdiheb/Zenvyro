import { ApplicationError } from '../utils/applicationError.js'
import { readBodyText } from '../utils/inputValidation.js'
import { MESSAGE_BODY_MAXIMUM_LENGTH } from '../utils/conversationValues.js'

export function validatePostMessageMiddleware(request, _response, nextFunction) {
  const messageBodyText = readBodyText(request.body, 'body').trim()

  if (messageBodyText.length === 0 || messageBodyText.length > MESSAGE_BODY_MAXIMUM_LENGTH) {
    return nextFunction(
      new ApplicationError(400, `body is required and must be 1 to ${MESSAGE_BODY_MAXIMUM_LENGTH} characters.`),
    )
  }

  request.validatedBody = { body: messageBodyText }
  return nextFunction()
}

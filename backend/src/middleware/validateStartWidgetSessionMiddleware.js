import { ApplicationError } from '../utils/applicationError.js'
import { readBodyText, isValidEmail } from '../utils/inputValidation.js'

// Widget keys are "wk_" followed by 32 lowercase hex characters (see authenticationService.js).
const WIDGET_KEY_PATTERN = /^wk_[0-9a-f]{32}$/
const VISITOR_NAME_MAXIMUM_LENGTH = 120

export function validateStartWidgetSessionMiddleware(request, _response, nextFunction) {
  const widgetKey = readBodyText(request.body, 'widgetKey').trim()
  if (!WIDGET_KEY_PATTERN.test(widgetKey)) {
    return nextFunction(new ApplicationError(400, 'widgetKey is required and must be a valid widget key.'))
  }

  const visitorName = readBodyText(request.body, 'name').trim()
  if (visitorName.length > VISITOR_NAME_MAXIMUM_LENGTH) {
    return nextFunction(
      new ApplicationError(400, `name must be at most ${VISITOR_NAME_MAXIMUM_LENGTH} characters.`),
    )
  }

  const visitorEmail = readBodyText(request.body, 'email').trim().toLowerCase()
  if (visitorEmail.length > 0 && !isValidEmail(visitorEmail)) {
    return nextFunction(new ApplicationError(400, 'email must be a valid email when given.'))
  }

  request.validatedBody = {
    widgetKey,
    visitorName: visitorName || null,
    visitorEmail: visitorEmail || null,
  }
  return nextFunction()
}

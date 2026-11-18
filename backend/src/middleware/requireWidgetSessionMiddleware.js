import { ApplicationError } from '../utils/applicationError.js'
import { findLiveWidgetSessionForToken } from '../services/widgetSessionService.js'

const BEARER_TOKEN_PATTERN = /^Bearer\s+(\S+)$/

// Reads "Authorization: Bearer <token>" and loads the live widget session it belongs to.
// On success it sets request.widgetSession for the controller.
export async function requireWidgetSessionMiddleware(request, _response, nextFunction) {
  const authorizationHeader = request.get('Authorization') ?? ''
  const bearerMatch = BEARER_TOKEN_PATTERN.exec(authorizationHeader)
  if (!bearerMatch) {
    return nextFunction(new ApplicationError(401, 'Start a chat session first.'))
  }

  const widgetSession = await findLiveWidgetSessionForToken(bearerMatch[1])
  if (!widgetSession) {
    return nextFunction(new ApplicationError(401, 'Your chat session has ended. Start a new chat.'))
  }

  request.widgetSession = widgetSession
  return nextFunction()
}

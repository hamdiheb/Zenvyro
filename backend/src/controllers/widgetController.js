import {
  startWidgetSessionForWidgetKey,
  getWidgetConversationWithRecentMessages,
} from '../services/widgetSessionService.js'

// The widget is embedded on other websites, so these handlers never read the staff session cookie.
export async function startWidgetSession(request, response) {
  const widgetSession = await startWidgetSessionForWidgetKey({
    widgetKey: request.validatedBody.widgetKey,
    visitorName: request.validatedBody.visitorName,
    visitorEmail: request.validatedBody.visitorEmail,
  })
  response.status(201).json(widgetSession)
}

export async function getWidgetSession(request, response) {
  const conversationWithMessages = await getWidgetConversationWithRecentMessages({
    widgetSession: request.widgetSession,
  })
  response.status(200).json(conversationWithMessages)
}

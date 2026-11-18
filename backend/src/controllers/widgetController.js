import {
  startWidgetSessionForWidgetKey,
  getWidgetConversationWithRecentMessages,
  postVisitorMessageToWidgetConversation,
} from '../services/widgetSessionService.js'
import { publishMessageCreatedToConversation } from '../realtime/conversationRealtimePublisher.js'

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

export async function postWidgetMessage(request, response) {
  const message = await postVisitorMessageToWidgetConversation({
    widgetSession: request.widgetSession,
    body: request.validatedBody.body,
  })
  // Saved and committed, so the agent inbox and the visitor's own socket can receive it live.
  publishMessageCreatedToConversation(request.app.get('socketServer'), {
    conversationId: message.conversationId,
    message,
  })
  response.status(201).json({ message })
}

import {
  startWidgetSessionForWidgetKey,
  getWidgetConversationWithRecentMessages,
  postVisitorMessageToWidgetConversation,
} from '../services/widgetSessionService.js'
import { getConversationForBusiness } from '../services/conversationsService.js'
import {
  publishMessageCreatedToConversation,
  publishConversationCreatedToBusiness,
  publishConversationUpdatedToBusiness,
} from '../realtime/conversationRealtimePublisher.js'

// The widget is embedded on other websites, so these handlers never read the staff session cookie.
export async function startWidgetSession(request, response) {
  const { businessId, ...widgetSession } = await startWidgetSessionForWidgetKey({
    widgetKey: request.validatedBody.widgetKey,
    visitorName: request.validatedBody.visitorName,
    visitorEmail: request.validatedBody.visitorEmail,
    ipAddress: request.ip,
  })
  // The new conversation appears in the business's inbox right away. The visitor is not in that room.
  const conversation = await getConversationForBusiness({ businessId, conversationId: widgetSession.conversation.id })
  publishConversationCreatedToBusiness(request.app.get('socketServer'), { businessId, conversation })
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
  const socketServer = request.app.get('socketServer')
  publishMessageCreatedToConversation(socketServer, {
    conversationId: message.conversationId,
    message,
  })
  // A visitor message can also reopen a resolved conversation, so the business's list gets the new state.
  const businessId = request.widgetSession.business_id
  const conversation = await getConversationForBusiness({ businessId, conversationId: message.conversationId })
  publishConversationUpdatedToBusiness(socketServer, { businessId, conversation })
  response.status(201).json({ message })
}

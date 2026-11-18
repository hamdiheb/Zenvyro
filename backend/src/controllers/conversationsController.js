import {
  createConversationForBusiness,
  listConversationsForBusiness,
  getConversationForBusiness,
  updateConversationForBusiness,
  listMessagesForConversation,
  postStaffMessageToConversation,
  replaceConversationLabelsForBusiness,
} from '../services/conversationsService.js'
import {
  publishMessageCreatedToConversation,
  publishConversationCreatedToBusiness,
  publishConversationUpdatedToBusiness,
} from '../realtime/conversationRealtimePublisher.js'

// Every handler scopes to the signed-in user's business. The conversation id comes from the URL.
export async function createConversation(request, response) {
  const businessId = request.authenticatedUser.businessId
  const conversation = await createConversationForBusiness({
    businessId,
    staffUserId: request.authenticatedUser.id,
    input: request.validatedBody,
  })
  publishConversationCreatedToBusiness(request.app.get('socketServer'), { businessId, conversation })
  response.status(201).json({ conversation })
}

export async function listConversations(request, response) {
  const page = await listConversationsForBusiness({
    businessId: request.authenticatedUser.businessId,
    staffUserId: request.authenticatedUser.id,
    filters: request.validatedQuery,
  })
  response.status(200).json(page)
}

export async function getConversation(request, response) {
  const conversation = await getConversationForBusiness({
    businessId: request.authenticatedUser.businessId,
    conversationId: request.params.conversationId,
  })
  response.status(200).json({ conversation })
}

export async function updateConversation(request, response) {
  const businessId = request.authenticatedUser.businessId
  const conversation = await updateConversationForBusiness({
    businessId,
    conversationId: request.params.conversationId,
    changes: request.validatedBody,
  })
  publishConversationUpdatedToBusiness(request.app.get('socketServer'), { businessId, conversation })
  response.status(200).json({ conversation })
}

export async function setConversationLabels(request, response) {
  const businessId = request.authenticatedUser.businessId
  const conversation = await replaceConversationLabelsForBusiness({
    businessId,
    conversationId: request.params.conversationId,
    labelIds: request.validatedBody.labelIds,
  })
  publishConversationUpdatedToBusiness(request.app.get('socketServer'), { businessId, conversation })
  response.status(200).json({ conversation })
}

export async function listConversationMessages(request, response) {
  const page = await listMessagesForConversation({
    businessId: request.authenticatedUser.businessId,
    conversationId: request.params.conversationId,
    filters: request.validatedQuery,
  })
  response.status(200).json(page)
}

export async function postConversationMessage(request, response) {
  const businessId = request.authenticatedUser.businessId
  const message = await postStaffMessageToConversation({
    businessId,
    staffUserId: request.authenticatedUser.id,
    conversationId: request.params.conversationId,
    body: request.validatedBody.body,
  })
  // The message is committed at this point, so live clients in the room can receive it.
  const socketServer = request.app.get('socketServer')
  publishMessageCreatedToConversation(socketServer, {
    conversationId: message.conversationId,
    message,
  })
  // The message also moves the conversation to the top of the inbox, so the business's list updates too.
  const conversation = await getConversationForBusiness({ businessId, conversationId: message.conversationId })
  publishConversationUpdatedToBusiness(socketServer, { businessId, conversation })
  response.status(201).json({ message })
}

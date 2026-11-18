import {
  createConversationForBusiness,
  listConversationsForBusiness,
  getConversationForBusiness,
  updateConversationForBusiness,
  listMessagesForConversation,
  postStaffMessageToConversation,
} from '../services/conversationsService.js'

// Every handler scopes to the signed-in user's business. The conversation id comes from the URL.
export async function createConversation(request, response) {
  const conversation = await createConversationForBusiness({
    businessId: request.authenticatedUser.businessId,
    staffUserId: request.authenticatedUser.id,
    input: request.validatedBody,
  })
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
  const conversation = await updateConversationForBusiness({
    businessId: request.authenticatedUser.businessId,
    conversationId: request.params.conversationId,
    changes: request.validatedBody,
  })
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
  const message = await postStaffMessageToConversation({
    businessId: request.authenticatedUser.businessId,
    staffUserId: request.authenticatedUser.id,
    conversationId: request.params.conversationId,
    body: request.validatedBody.body,
  })
  response.status(201).json({ message })
}

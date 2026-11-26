import { requestJson, buildQueryString } from './apiClient.js'

const CONVERSATIONS_BASE_PATH = '/api/conversations'

export function listConversations({ view, status, cursor, limit }) {
  return requestJson(`${CONVERSATIONS_BASE_PATH}${buildQueryString({ view, status, cursor, limit })}`)
}

export function getConversation(conversationId) {
  return requestJson(`${CONVERSATIONS_BASE_PATH}/${conversationId}`)
}

// changes holds any of: status, mode, assignedAgentId (null unassigns).
export function updateConversation(conversationId, changes) {
  return requestJson(`${CONVERSATIONS_BASE_PATH}/${conversationId}`, { method: 'PATCH', body: changes })
}

export function listConversationMessages(conversationId, { cursor, limit } = {}) {
  return requestJson(`${CONVERSATIONS_BASE_PATH}/${conversationId}/messages${buildQueryString({ cursor, limit })}`)
}

export function postConversationMessage(conversationId, messageBody) {
  return requestJson(`${CONVERSATIONS_BASE_PATH}/${conversationId}/messages`, {
    method: 'POST',
    body: { body: messageBody },
  })
}

// Replaces the conversation's whole label set.
export function setConversationLabels(conversationId, labelIds) {
  return requestJson(`${CONVERSATIONS_BASE_PATH}/${conversationId}/labels`, { method: 'PUT', body: { labelIds } })
}

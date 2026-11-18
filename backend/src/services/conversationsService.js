import { pool } from '../db/databasePool.js'
import { ApplicationError } from '../utils/applicationError.js'
import { encodePaginationCursor } from '../utils/paginationCursor.js'
import { RESOLVED_CONVERSATION_STATUS } from '../utils/conversationValues.js'
import {
  findCustomerForBusiness,
  findExistingCustomerForBusiness,
  insertCustomer,
} from '../repositories/customersRepository.js'
import {
  insertConversation,
  findConversationForBusiness,
  findConversationsPageForBusiness,
  lockConversationForBusiness,
  updateConversationStatusAndMode,
  touchConversationLastMessageAt,
} from '../repositories/conversationsRepository.js'
import { insertMessage, findMessagesPageForConversation } from '../repositories/messagesRepository.js'

const STAFF_SENDER_TYPE = 'agent'
const CONVERSATION_NOT_FOUND_MESSAGE = 'Conversation not found.'
const CUSTOMER_NOT_FOUND_MESSAGE = 'Customer not found.'
const CONVERSATION_RESOLVED_MESSAGE = 'This conversation is resolved. Reopen it before sending a message.'

function toPublicConversation(conversationRow) {
  return {
    id: conversationRow.id,
    customerId: conversationRow.customer_id,
    customerName: conversationRow.customer_name,
    customerEmail: conversationRow.customer_email,
    channel: conversationRow.channel,
    mode: conversationRow.mode,
    status: conversationRow.status,
    assignedAgentId: conversationRow.assigned_agent_id,
    lastMessageAt: conversationRow.last_message_at,
    resolvedAt: conversationRow.resolved_at,
    createdAt: conversationRow.created_at,
    updatedAt: conversationRow.updated_at,
  }
}

function toPublicMessage(messageRow) {
  return {
    id: messageRow.id,
    conversationId: messageRow.conversation_id,
    senderType: messageRow.sender_type,
    senderId: messageRow.sender_id,
    body: messageRow.body,
    createdAt: messageRow.created_at,
  }
}

// Reuses a customer with the same external id or email in this business, otherwise creates one.
async function findOrCreateCustomerForBusiness(databaseExecutor, { businessId, newCustomer }) {
  const existingCustomerRow = await findExistingCustomerForBusiness(databaseExecutor, {
    businessId,
    externalId: newCustomer.externalId,
    email: newCustomer.email,
  })
  if (existingCustomerRow) {
    return existingCustomerRow
  }
  return insertCustomer(databaseExecutor, { businessId, ...newCustomer })
}

// Inserts a message and moves the conversation to the top of the inbox, in the same transaction.
async function insertMessageAndTouchConversation(databaseExecutor, { conversationId, senderType, senderId, body }) {
  const messageRow = await insertMessage(databaseExecutor, { conversationId, senderType, senderId, body })
  await touchConversationLastMessageAt(databaseExecutor, { conversationId })
  return messageRow
}

// Creates a conversation for an existing customer or a new one, with an optional first message.
export async function createConversationForBusiness({ businessId, staffUserId, input }) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const customerRow = input.customerId
      ? await findCustomerForBusiness(client, { businessId, customerId: input.customerId })
      : await findOrCreateCustomerForBusiness(client, { businessId, newCustomer: input.newCustomer })
    if (!customerRow) {
      throw new ApplicationError(404, CUSTOMER_NOT_FOUND_MESSAGE)
    }

    const conversationRow = await insertConversation(client, { businessId, customerId: customerRow.id })
    if (input.firstMessageText) {
      await insertMessageAndTouchConversation(client, {
        conversationId: conversationRow.id,
        senderType: STAFF_SENDER_TYPE,
        senderId: staffUserId,
        body: input.firstMessageText,
      })
    }

    const savedConversationRow = await findConversationForBusiness(client, {
      businessId,
      conversationId: conversationRow.id,
    })
    await client.query('COMMIT')
    return toPublicConversation(savedConversationRow)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listConversationsForBusiness({ businessId, staffUserId, filters }) {
  const fetchCount = filters.limit + 1
  const conversationRows = await findConversationsPageForBusiness(pool, {
    businessId,
    staffUserId,
    view: filters.view,
    status: filters.status,
    mode: filters.mode,
    customerId: filters.customerId,
    cursor: filters.cursor,
    fetchCount,
  })

  const hasMoreRows = conversationRows.length > filters.limit
  const pageRows = conversationRows.slice(0, filters.limit)
  const lastPageRow = pageRows[pageRows.length - 1]

  return {
    conversations: pageRows.map(toPublicConversation),
    nextCursor: hasMoreRows
      ? encodePaginationCursor({ sortValue: lastPageRow.sort_value, id: lastPageRow.id })
      : null,
  }
}

export async function getConversationForBusiness({ businessId, conversationId }) {
  const conversationRow = await findConversationForBusiness(pool, { businessId, conversationId })
  if (!conversationRow) {
    throw new ApplicationError(404, CONVERSATION_NOT_FOUND_MESSAGE)
  }
  return toPublicConversation(conversationRow)
}

// Changes status and/or mode. Moving to resolved sets resolved_at; reopening clears it.
export async function updateConversationForBusiness({ businessId, conversationId, changes }) {
  const isUpdated = await updateConversationStatusAndMode(pool, {
    businessId,
    conversationId,
    status: changes.status,
    mode: changes.mode,
  })
  if (!isUpdated) {
    throw new ApplicationError(404, CONVERSATION_NOT_FOUND_MESSAGE)
  }
  return getConversationForBusiness({ businessId, conversationId })
}

// Returns one page of messages, oldest first within the page. nextCursor leads to older messages.
export async function listMessagesForConversation({ businessId, conversationId, filters }) {
  await getConversationForBusiness({ businessId, conversationId })

  const fetchCount = filters.limit + 1
  const messageRows = await findMessagesPageForConversation(pool, {
    conversationId,
    cursor: filters.cursor,
    fetchCount,
  })

  const hasMoreRows = messageRows.length > filters.limit
  const pageRowsNewestFirst = messageRows.slice(0, filters.limit)
  const oldestPageRow = pageRowsNewestFirst[pageRowsNewestFirst.length - 1]

  return {
    messages: pageRowsNewestFirst.reverse().map(toPublicMessage),
    nextCursor: hasMoreRows
      ? encodePaginationCursor({ sortValue: oldestPageRow.sort_value, id: oldestPageRow.id })
      : null,
  }
}

// Locks the conversation so the status check and the insert cannot race with a resolve.
export async function postStaffMessageToConversation({ businessId, staffUserId, conversationId, body }) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const lockedConversationRow = await lockConversationForBusiness(client, { businessId, conversationId })
    if (!lockedConversationRow) {
      throw new ApplicationError(404, CONVERSATION_NOT_FOUND_MESSAGE)
    }
    if (lockedConversationRow.status === RESOLVED_CONVERSATION_STATUS) {
      throw new ApplicationError(409, CONVERSATION_RESOLVED_MESSAGE)
    }

    const messageRow = await insertMessageAndTouchConversation(client, {
      conversationId,
      senderType: STAFF_SENDER_TYPE,
      senderId: staffUserId,
      body,
    })
    await client.query('COMMIT')
    return toPublicMessage(messageRow)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

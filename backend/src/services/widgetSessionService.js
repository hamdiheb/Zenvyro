import { pool } from '../db/databasePool.js'
import { environmentConfig } from '../config/environmentConfig.js'
import { ApplicationError } from '../utils/applicationError.js'
import { findBusinessByWidgetKey } from '../repositories/businessesRepository.js'
import { insertCustomer } from '../repositories/customersRepository.js'
import {
  insertConversation,
  findConversationForBusiness,
} from '../repositories/conversationsRepository.js'
import { findMessagesPageForConversation } from '../repositories/messagesRepository.js'
import {
  insertWidgetSession,
  findLiveWidgetSessionByTokenHash,
} from '../repositories/widgetSessionsRepository.js'
import { generateSessionToken, hashSessionToken } from './sessionTokenService.js'

const INVALID_WIDGET_KEY_MESSAGE = 'The widget key is not valid.'
const DEFAULT_VISITOR_NAME = 'Website visitor'

// Creates the visitor (customer), their conversation and a widget session token in one transaction.
// The widget key identifies the business. It is public, so it grants only this one-visitor session.
export async function startWidgetSessionForWidgetKey({ widgetKey, visitorName, visitorEmail }) {
  const businessRow = await findBusinessByWidgetKey(pool, { widgetKey })
  if (!businessRow) {
    throw new ApplicationError(401, INVALID_WIDGET_KEY_MESSAGE)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const customerRow = await insertCustomer(client, {
      businessId: businessRow.id,
      name: visitorName ?? DEFAULT_VISITOR_NAME,
      email: visitorEmail ?? null,
      externalId: null,
    })
    const conversationRow = await insertConversation(client, {
      businessId: businessRow.id,
      customerId: customerRow.id,
    })

    const sessionToken = generateSessionToken()
    await insertWidgetSession(client, {
      businessId: businessRow.id,
      customerId: customerRow.id,
      conversationId: conversationRow.id,
      tokenHash: hashSessionToken(sessionToken),
      durationSeconds: environmentConfig.widgetSessionDurationSeconds,
    })

    await client.query('COMMIT')
    return {
      sessionToken,
      customer: { id: customerRow.id, name: customerRow.name },
      conversation: { id: conversationRow.id },
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Returns the live widget session for a token from the Authorization header, or null when it is
// unknown or expired. Shared by the REST middleware and the realtime gateway.
export async function findLiveWidgetSessionForToken(sessionToken) {
  return findLiveWidgetSessionByTokenHash(pool, hashSessionToken(sessionToken))
}

const VISITOR_MESSAGE_HISTORY_LIMIT = 50

// Returns the visitor's conversation and its newest messages, oldest first.
// Only fields the visitor may see are returned: no assigned agent and no sender ids.
export async function getWidgetConversationWithRecentMessages({ widgetSession }) {
  const conversationRow = await findConversationForBusiness(pool, {
    businessId: widgetSession.business_id,
    conversationId: widgetSession.conversation_id,
  })
  const messageRowsNewestFirst = await findMessagesPageForConversation(pool, {
    conversationId: widgetSession.conversation_id,
    cursor: null,
    fetchCount: VISITOR_MESSAGE_HISTORY_LIMIT,
  })

  return {
    conversation: {
      id: conversationRow.id,
      status: conversationRow.status,
      createdAt: conversationRow.created_at,
    },
    messages: messageRowsNewestFirst.reverse().map((messageRow) => ({
      id: messageRow.id,
      senderType: messageRow.sender_type,
      body: messageRow.body,
      createdAt: messageRow.created_at,
    })),
  }
}

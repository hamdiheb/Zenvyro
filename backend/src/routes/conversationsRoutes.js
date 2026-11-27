import { Router } from 'express'
import { requireSessionMiddleware } from '../middleware/requireSessionMiddleware.js'
import { validateConversationIdMiddleware } from '../middleware/validateConversationIdMiddleware.js'
import { validateCreateConversationMiddleware } from '../middleware/validateCreateConversationMiddleware.js'
import { validateListConversationsMiddleware } from '../middleware/validateListConversationsMiddleware.js'
import { validateUpdateConversationMiddleware } from '../middleware/validateUpdateConversationMiddleware.js'
import { requireRoleToHandBackToAiMiddleware } from '../middleware/requireRoleToHandBackToAiMiddleware.js'
import { validateListMessagesMiddleware } from '../middleware/validateListMessagesMiddleware.js'
import { validatePostMessageMiddleware } from '../middleware/validatePostMessageMiddleware.js'
import { validateSetConversationLabelsMiddleware } from '../middleware/validateSetConversationLabelsMiddleware.js'
import {
  createConversation,
  listConversations,
  getConversation,
  updateConversation,
  listConversationMessages,
  postConversationMessage,
  setConversationLabels,
} from '../controllers/conversationsController.js'

// Mounted at /api/conversations in app.js. Every endpoint needs a staff session.
export const conversationsRoutes = Router()

conversationsRoutes.use(requireSessionMiddleware)

conversationsRoutes.post('/', validateCreateConversationMiddleware, createConversation)
conversationsRoutes.get('/', validateListConversationsMiddleware, listConversations)
conversationsRoutes.get('/:conversationId', validateConversationIdMiddleware, getConversation)
conversationsRoutes.patch(
  '/:conversationId',
  validateConversationIdMiddleware,
  validateUpdateConversationMiddleware,
  requireRoleToHandBackToAiMiddleware,
  updateConversation,
)
conversationsRoutes.get(
  '/:conversationId/messages',
  validateConversationIdMiddleware,
  validateListMessagesMiddleware,
  listConversationMessages,
)
conversationsRoutes.put(
  '/:conversationId/labels',
  validateConversationIdMiddleware,
  validateSetConversationLabelsMiddleware,
  setConversationLabels,
)
conversationsRoutes.post(
  '/:conversationId/messages',
  validateConversationIdMiddleware,
  validatePostMessageMiddleware,
  postConversationMessage,
)

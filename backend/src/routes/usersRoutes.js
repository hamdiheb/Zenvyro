import { Router } from 'express'
import { requireSessionMiddleware } from '../middleware/requireSessionMiddleware.js'
import { requireRoleMiddleware } from '../middleware/requireRoleMiddleware.js'
import { validateCreateInvitationMiddleware } from '../middleware/validateCreateInvitationMiddleware.js'
import { validateUserIdMiddleware } from '../middleware/validateUserIdMiddleware.js'
import { validateUpdateUserRoleMiddleware } from '../middleware/validateUpdateUserRoleMiddleware.js'
import { STAFF_MANAGER_ROLES } from '../utils/userRoles.js'
import {
  listUsers,
  createInvitation,
  updateUserRole,
  removeUser,
} from '../controllers/usersController.js'

// Mounted at /api/users in app.js. Every endpoint needs a staff session.
// Listing staff is open to every role (agent picker); managing staff is owner/admin only.
export const usersRoutes = Router()
const requireStaffManager = requireRoleMiddleware(STAFF_MANAGER_ROLES)

usersRoutes.use(requireSessionMiddleware)
usersRoutes.get('/', listUsers)
usersRoutes.post('/invitations', requireStaffManager, validateCreateInvitationMiddleware, createInvitation)
usersRoutes.patch(
  '/:userId',
  requireStaffManager,
  validateUserIdMiddleware,
  validateUpdateUserRoleMiddleware,
  updateUserRole,
)
usersRoutes.delete('/:userId', requireStaffManager, validateUserIdMiddleware, removeUser)

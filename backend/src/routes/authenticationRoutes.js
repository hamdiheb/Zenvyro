import { Router } from 'express'
import { validateSignUpMiddleware } from '../middleware/validateSignUpMiddleware.js'
import { validateSignInMiddleware } from '../middleware/validateSignInMiddleware.js'
import { validateAcceptInvitationMiddleware } from '../middleware/validateAcceptInvitationMiddleware.js'
import { requireSessionMiddleware } from '../middleware/requireSessionMiddleware.js'
import {
  signUp,
  signIn,
  acceptInvitation,
  getCurrentUser,
  signOut,
} from '../controllers/authenticationController.js'

// Mounted at /api/authentication in app.js.
export const authenticationRoutes = Router()

authenticationRoutes.post('/sign-up', validateSignUpMiddleware, signUp)
authenticationRoutes.post('/sign-in', validateSignInMiddleware, signIn)
// Public: the invitation token is the credential.
authenticationRoutes.post('/accept-invitation', validateAcceptInvitationMiddleware, acceptInvitation)
authenticationRoutes.get('/me', requireSessionMiddleware, getCurrentUser)
authenticationRoutes.post('/sign-out', requireSessionMiddleware, signOut)

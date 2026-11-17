import { Router } from 'express'
import { validateSignUpMiddleware } from '../middleware/validateSignUpMiddleware.js'
import { validateSignInMiddleware } from '../middleware/validateSignInMiddleware.js'
import { requireSessionMiddleware } from '../middleware/requireSessionMiddleware.js'
import {
  signUp,
  signIn,
  getCurrentUser,
  signOut,
} from '../controllers/authenticationController.js'

// Mounted at /api/authentication in app.js.
export const authenticationRoutes = Router()

authenticationRoutes.post('/sign-up', validateSignUpMiddleware, signUp)
authenticationRoutes.post('/sign-in', validateSignInMiddleware, signIn)
authenticationRoutes.get('/me', requireSessionMiddleware, getCurrentUser)
authenticationRoutes.post('/sign-out', requireSessionMiddleware, signOut)

import { Router } from 'express'
import { requireSessionMiddleware } from '../middleware/requireSessionMiddleware.js'
import { listUsers } from '../controllers/usersController.js'

// Mounted at /api/users in app.js. Every endpoint needs a staff session.
export const usersRoutes = Router()

usersRoutes.use(requireSessionMiddleware)
usersRoutes.get('/', listUsers)

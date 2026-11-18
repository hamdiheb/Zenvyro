import { Router } from 'express'
import { requireSessionMiddleware } from '../middleware/requireSessionMiddleware.js'
import { validateCreateLabelMiddleware } from '../middleware/validateCreateLabelMiddleware.js'
import { listLabels, createLabel } from '../controllers/labelsController.js'

// Mounted at /api/labels in app.js. Every endpoint needs a staff session.
export const labelsRoutes = Router()

labelsRoutes.use(requireSessionMiddleware)
labelsRoutes.get('/', listLabels)
labelsRoutes.post('/', validateCreateLabelMiddleware, createLabel)

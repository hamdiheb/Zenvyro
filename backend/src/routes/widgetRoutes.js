import { Router } from 'express'
import { validateStartWidgetSessionMiddleware } from '../middleware/validateStartWidgetSessionMiddleware.js'
import { requireWidgetSessionMiddleware } from '../middleware/requireWidgetSessionMiddleware.js'
import { startWidgetSession, getWidgetSession } from '../controllers/widgetController.js'

// Mounted at /api/widget in app.js. Visitors authenticate with a widget session token
// (Authorization: Bearer), never with the staff cookie.
export const widgetRoutes = Router()

widgetRoutes.post('/sessions', validateStartWidgetSessionMiddleware, startWidgetSession)
widgetRoutes.get('/session', requireWidgetSessionMiddleware, getWidgetSession)

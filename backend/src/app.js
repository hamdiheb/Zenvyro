import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { environmentConfig } from './config/environmentConfig.js'
import { authenticationRoutes } from './routes/authenticationRoutes.js'
import { conversationsRoutes } from './routes/conversationsRoutes.js'
import { widgetRoutes } from './routes/widgetRoutes.js'
import { errorHandlerMiddleware } from './middleware/errorHandlerMiddleware.js'
import { ApplicationError } from './utils/applicationError.js'

export const app = express()

// The widget runs on other websites, so its routes accept any origin. They use a bearer token,
// not the cookie, so no credentials are allowed. The staff allowlist below does not apply to them.
app.use('/api/widget', cors({ origin: true }))
app.use(
  cors({
    origin: environmentConfig.corsAllowedOrigins,
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

app.use('/api/authentication', authenticationRoutes)
app.use('/api/conversations', conversationsRoutes)
app.use('/api/widget', widgetRoutes)

app.use((_request, _response, nextFunction) => {
  nextFunction(new ApplicationError(404, 'Route not found.'))
})

app.use(errorHandlerMiddleware)

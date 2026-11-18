import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { environmentConfig } from './config/environmentConfig.js'
import { authenticationRoutes } from './routes/authenticationRoutes.js'
import { conversationsRoutes } from './routes/conversationsRoutes.js'
import { widgetRoutes } from './routes/widgetRoutes.js'
import { labelsRoutes } from './routes/labelsRoutes.js'
import { usersRoutes } from './routes/usersRoutes.js'
import { errorHandlerMiddleware } from './middleware/errorHandlerMiddleware.js'
import { ApplicationError } from './utils/applicationError.js'

export const app = express()

// Behind a load balancer, req.ip must be the visitor's address, not the proxy's (see TRUST_PROXY_HOP_COUNT).
app.set('trust proxy', environmentConfig.trustProxyHopCount)

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
app.use('/api/labels', labelsRoutes)
app.use('/api/users', usersRoutes)

app.use((_request, _response, nextFunction) => {
  nextFunction(new ApplicationError(404, 'Route not found.'))
})

app.use(errorHandlerMiddleware)

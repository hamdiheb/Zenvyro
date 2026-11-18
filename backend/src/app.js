import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { environmentConfig } from './config/environmentConfig.js'
import { authenticationRoutes } from './routes/authenticationRoutes.js'
import { conversationsRoutes } from './routes/conversationsRoutes.js'
import { errorHandlerMiddleware } from './middleware/errorHandlerMiddleware.js'
import { ApplicationError } from './utils/applicationError.js'

export const app = express()

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

app.use((_request, _response, nextFunction) => {
  nextFunction(new ApplicationError(404, 'Route not found.'))
})

app.use(errorHandlerMiddleware)

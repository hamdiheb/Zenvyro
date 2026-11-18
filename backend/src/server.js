import { createServer } from 'node:http'
import { app } from './app.js'
import { environmentConfig } from './config/environmentConfig.js'
import { createSocketGateway } from './realtime/socketGateway.js'

// Express and Socket.IO share one HTTP server. The gateway is stored on the app so
// controllers can publish realtime events without importing the server.
const httpServer = createServer(app)
const socketServer = createSocketGateway(httpServer)
app.set('socketServer', socketServer)

const server = httpServer.listen(environmentConfig.port, () => {
  console.log(`API listening on port ${environmentConfig.port}`)
})

export { server }

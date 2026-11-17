import { app } from './app.js'
import { environmentConfig } from './config/environmentConfig.js'

const server = app.listen(environmentConfig.port, () => {
  console.log(`API listening on port ${environmentConfig.port}`)
})

export { server }

import { Pool } from 'pg'
import { environmentConfig } from '../config/environmentConfig.js'

export const pool = new Pool({
  connectionString: environmentConfig.databaseUrl,
})

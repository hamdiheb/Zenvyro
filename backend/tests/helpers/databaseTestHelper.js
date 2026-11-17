import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool } from '../../src/db/databasePool.js'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const schemaFilePath = join(currentDirectory, '..', '..', 'db', 'schema.sql')

// Applies db/schema.sql once if the users table is missing. Later runs are no-ops.
export async function prepareTestDatabase() {
  const existingTableResult = await pool.query(`SELECT to_regclass('public.users') AS table_name`)
  if (existingTableResult.rows[0].table_name === null) {
    await pool.query(readFileSync(schemaFilePath, 'utf8'))
  }
}

// Empties the tables the auth tests write to. Cascades to users and sessions.
export async function clearTestDatabase() {
  await pool.query('TRUNCATE TABLE businesses CASCADE')
}

export async function closeTestDatabase() {
  await pool.end()
}

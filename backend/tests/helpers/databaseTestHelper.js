import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool } from '../../src/db/databasePool.js'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const migrationsDirectory = join(currentDirectory, '..', '..', 'db', 'migrations')
const BASELINE_MIGRATION_FILENAME = '001_initial_schema.sql'

// Applies db/migrations/*.sql in filename order, the same way db/migrate.sh does for the dev database:
// each file runs in its own transaction and is recorded in schema_migrations, so a new migration
// reaches the test database on the next run and applied ones are skipped.
export async function prepareTestDatabase() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  )

  // Test databases built by the earlier helper (from db/schema.sql) already hold the baseline schema.
  const usersTableResult = await pool.query(`SELECT to_regclass('public.users') AS table_name`)
  if (usersTableResult.rows[0].table_name !== null) {
    await pool.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
      [BASELINE_MIGRATION_FILENAME],
    )
  }

  const appliedResult = await pool.query('SELECT filename FROM schema_migrations')
  const appliedFilenames = new Set(appliedResult.rows.map((row) => row.filename))
  const migrationFilenames = readdirSync(migrationsDirectory)
    .filter((filename) => filename.endsWith('.sql'))
    .sort()

  for (const filename of migrationFilenames) {
    if (appliedFilenames.has(filename)) {
      continue
    }
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(readFileSync(join(migrationsDirectory, filename), 'utf8'))
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

// Empties the tables the tests write to. Cascades to users, sessions, invitations and conversations.
export async function clearTestDatabase() {
  await pool.query('TRUNCATE TABLE businesses CASCADE')
}

export async function closeTestDatabase() {
  await pool.end()
}

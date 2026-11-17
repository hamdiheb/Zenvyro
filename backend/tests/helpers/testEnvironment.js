import 'dotenv/config'

// Runs before every test file. Points the app at the real saad_test database
// before environmentConfig.js reads process.env.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is not set. Tests must run against the saad_test database.')
}

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173'

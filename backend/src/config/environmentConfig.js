import './loadProjectEnvironmentFile.js'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
}

const THREE_DAYS_IN_SECONDS = 3 * 24 * 60 * 60
const nodeEnvironment = process.env.NODE_ENV ?? 'development'

export const environmentConfig = Object.freeze({
  databaseUrl,
  nodeEnvironment,
  port: Number(process.env.PORT ?? 4000),
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  sessionCookieName: 'zenvyro_session',
  sessionDurationSeconds: THREE_DAYS_IN_SECONDS,
  sessionDurationMilliseconds: THREE_DAYS_IN_SECONDS * 1000,
  // Widget visitors keep their chat for longer than staff sessions, so they can come back to it.
  widgetSessionDurationSeconds: 30 * 24 * 60 * 60,
  isCookieSecure: nodeEnvironment === 'production',
})

-- Anonymous chat sessions for the embeddable customer widget. One row per widget visitor session.
-- Visitors are customers, not staff users, so they cannot use the sessions table (it points at users).
-- Only the SHA-256 hash of the session token is stored, the same rule as staff sessions.
-- Also present in db/schema.sql; the table is created only if it does not exist yet.
CREATE TABLE IF NOT EXISTS widget_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS widget_sessions_expires_at_idx ON widget_sessions (expires_at);

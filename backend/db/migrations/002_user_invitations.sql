-- Staff invitations (R11, D13). An owner or admin invites an email with a role; the invitee accepts
-- with a single-use link and becomes a user of the inviting business.
-- Only the SHA-256 hash of the invitation token is stored, the same rule as sessions.
-- The owner role cannot be invited: each business has exactly one owner, created at sign-up.
CREATE TABLE user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'agent')),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  CHECK (expires_at > created_at)
);
-- At most one open invitation per email in a business. Re-inviting replaces the open one.
CREATE UNIQUE INDEX user_invitations_open_email_idx
  ON user_invitations (business_id, email)
  WHERE accepted_at IS NULL;

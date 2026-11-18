-- Supports the conversation inbox: newest activity first within one business.
-- Also present in db/schema.sql; IF NOT EXISTS keeps running both harmless.
CREATE INDEX IF NOT EXISTS conversations_business_last_message_idx
  ON conversations (business_id, last_message_at DESC, id DESC);

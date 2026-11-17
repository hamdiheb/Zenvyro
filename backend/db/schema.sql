-- Saad SaaS: full PostgreSQL schema (baseline).
-- Raw SQL only, no ORM. Tables are plural snake_case; timestamps end in _at; booleans start with is_, has_ or can_.
-- Applied once by the migration runner (node src/db/databaseCommands.js migrate). Later changes go in db/migrations/.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  widget_key text NOT NULL UNIQUE,
  brand_tone text NOT NULL DEFAULT 'Friendly, clear and professional',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'agent')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_business_id_idx ON users (business_id);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  external_id text,
  name text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_business_id_idx ON customers (business_id);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'web_widget' CHECK (channel IN ('web_widget')),
  mode text NOT NULL DEFAULT 'human' CHECK (mode IN ('ai', 'human')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'escalated')),
  assigned_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  category text,
  sentiment text CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  csat_score smallint CHECK (csat_score BETWEEN 1 AND 5),
  origin_detection_status text NOT NULL DEFAULT 'not_attempted'
    CHECK (origin_detection_status IN ('not_attempted', 'detected', 'unavailable', 'private_address')),
  origin_country_code char(2),
  origin_country_name text,
  origin_region text,
  origin_flag_image_url text,
  origin_languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  origin_currencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  origin_detected_at timestamptz,
  last_message_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_business_status_idx ON conversations (business_id, status);
CREATE INDEX conversations_business_assigned_agent_idx ON conversations (business_id, assigned_agent_id);
CREATE INDEX conversations_customer_id_idx ON conversations (customer_id);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'ai', 'agent', 'system')),
  sender_id uuid,
  body text NOT NULL,
  original_body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_created_idx ON messages (conversation_id, created_at);

CREATE TABLE business_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_rules_business_id_idx ON business_rules (business_id);

CREATE TABLE knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_articles_search_vector_idx ON knowledge_articles USING GIN (search_vector);
CREATE INDEX knowledge_articles_business_id_idx ON knowledge_articles (business_id);

CREATE TABLE message_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  original_body text NOT NULL,
  suggested_body text,
  grammar_status text CHECK (grammar_status IN ('passed', 'failed', 'needs_improvement')),
  policy_status text CHECK (policy_status IN ('passed', 'failed', 'needs_improvement')),
  tone_status text CHECK (tone_status IN ('passed', 'failed', 'needs_improvement')),
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  agent_action text CHECK (agent_action IN ('approved', 'edited', 'rejected')),
  final_body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_verifications_conversation_idx ON message_verifications (conversation_id);

CREATE TABLE ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(4, 3) CHECK (confidence BETWEEN 0 AND 1),
  latency_in_milliseconds integer,
  model_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_events_conversation_idx ON ai_events (conversation_id);

CREATE TABLE labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  color_hex text NOT NULL DEFAULT '#4a6cf7' CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

CREATE TABLE conversation_labels (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, label_id)
);

CREATE TABLE canned_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  shortcut_text text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, shortcut_text)
);

CREATE TABLE internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX internal_notes_conversation_idx ON internal_notes (conversation_id);

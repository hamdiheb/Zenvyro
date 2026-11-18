-- Idempotent seed data for local development. Demo business "Acme Shoes" (full demo data arrives in week 3).
-- The widget key must match the format the widget API accepts: "wk_" followed by 32 lowercase hex characters.
-- This key is public demo data for local use only; real businesses get a random key at sign-up.
-- A database seeded with the old malformed key (wk_acme_demo_local_only) is moved to the new key.
INSERT INTO businesses (name, slug, widget_key, brand_tone)
VALUES ('Acme Shoes', 'acme-shoes', 'wk_ace5ace5ace5ace5ace5ace5ace5ace5', 'Friendly, concise and professional')
ON CONFLICT (slug) DO UPDATE
  SET widget_key = EXCLUDED.widget_key
  WHERE businesses.widget_key = 'wk_acme_demo_local_only';

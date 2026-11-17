-- Idempotent seed data for local development. Demo business "Acme Shoes" (full demo data arrives in week 3).
INSERT INTO businesses (name, slug, widget_key, brand_tone)
VALUES ('Acme Shoes', 'acme-shoes', 'wk_acme_demo_local_only', 'Friendly, concise and professional')
ON CONFLICT (slug) DO NOTHING;

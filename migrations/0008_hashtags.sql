-- Per-post AI-generated hashtags, combined at publish time with a fixed brand set
-- (stored in KV as brand_fixed_hashtags, editable from /admin/social) — Esteban wants
-- zero manual hashtag writing, only reviewing what the AI already produced.
ALTER TABLE brand_posts ADD COLUMN hashtags TEXT;

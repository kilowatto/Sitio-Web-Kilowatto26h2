-- Lets the admin "review vigencia" of a topic (e.g. catch "Kimi K3" going stale once K4
-- ships) and track when that last happened, instead of topics sitting inert forever.
ALTER TABLE brand_topics ADD COLUMN last_reviewed_at TEXT;
ALTER TABLE brand_topics ADD COLUMN stale_flag INTEGER NOT NULL DEFAULT 0;
ALTER TABLE brand_topics ADD COLUMN review_note TEXT;

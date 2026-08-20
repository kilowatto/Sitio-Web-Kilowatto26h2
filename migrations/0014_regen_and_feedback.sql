-- Tracks whether a posted row's real-world performance has already been evaluated for
-- the negative-feedback RAG loop (see src/lib/underperformance.ts), so the same post
-- isn't re-embedded into kilowatto-brand-feedback on every cron tick.
ALTER TABLE brand_posts ADD COLUMN feedback_recorded INTEGER NOT NULL DEFAULT 0;

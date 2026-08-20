-- Surfaces the fact-check flag in the approval admin UI, mirroring brand_posts.rejection_reason.
ALTER TABLE columns ADD COLUMN rejection_reason TEXT;

-- Public archive.org link captured alongside raw_content_r2_key (added in 0001 but never
-- wired up) — together they mean a press mention survives even if the source disappears.
ALTER TABLE press_mentions ADD COLUMN archive_url TEXT;

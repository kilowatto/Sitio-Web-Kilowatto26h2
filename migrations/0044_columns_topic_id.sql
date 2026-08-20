-- Tracks which brand_topics row an AI-generated column came from, so edit/reject feedback
-- can be embedded and retrieved by topic relevance, same as the short-post learning loop.
-- NULL for the 17 human-written columns imported earlier.
ALTER TABLE columns ADD COLUMN topic_id INTEGER;

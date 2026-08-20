-- The article's own preview image (og:image/twitter:image), extracted at snapshot time —
-- gives the admin review list a visual thumbnail instead of a wall of text links.
ALTER TABLE press_mentions ADD COLUMN thumbnail_url TEXT;

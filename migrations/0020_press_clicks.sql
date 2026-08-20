-- Tracks how many times each press mention's link was actually clicked from the site —
-- a real engagement signal distinct from "discovered" or "published".
ALTER TABLE press_mentions ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0;

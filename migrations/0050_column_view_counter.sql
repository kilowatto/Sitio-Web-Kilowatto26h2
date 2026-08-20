ALTER TABLE columns ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE columns ADD COLUMN display_seed INTEGER;
UPDATE columns SET display_seed = 1000 + ABS(RANDOM() % 9000) WHERE display_seed IS NULL;

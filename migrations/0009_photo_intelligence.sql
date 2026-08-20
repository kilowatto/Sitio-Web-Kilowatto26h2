-- Exact-duplicate detection (SHA-256 of the raw file bytes) at upload time — near-duplicate
-- detection lives in Vectorize (kilowatto-photo-dedup), this just catches re-uploading the
-- literal same file. wearing_orange feeds the caption generator's signature callback line.
ALTER TABLE photos ADD COLUMN file_hash TEXT;
ALTER TABLE photos ADD COLUMN wearing_orange INTEGER DEFAULT 0;
CREATE INDEX idx_photos_file_hash ON photos(file_hash);

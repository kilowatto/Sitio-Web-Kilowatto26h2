-- Byte size of the audio file. Apple requires <enclosure length="..."> in the podcast feed and
-- players use it for the download progress bar. Stored rather than HEADed at render time: a
-- feed with 23 episodes would otherwise make 23 R2 round-trips on every request, including
-- every poll from every podcast client.
ALTER TABLE media_assets ADD COLUMN bytes INTEGER;

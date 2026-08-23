-- Adds 'audio_dialogue' to media_assets.kind.
--
-- The narrated investigaciones run 27, 30 and 64 minutes, which is not a length anyone listens
-- to. The conversational version between Larry and Leia is a DIFFERENT asset for the same piece
-- and locale, not a replacement: the article page keeps the faithful narration because that is
-- what the paragraph sync and follow-scroll are built against, and the podcast feed carries
-- both.
--
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt. Column order and every
-- constraint below must match 0061 plus the two ALTERs in 0062 and 0063 -- a silently dropped
-- column here would take the cue maps and the enclosure byte counts with it.

PRAGMA foreign_keys = OFF;

CREATE TABLE media_assets_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('columna', 'investigacion')),
  entity_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('audio_narration', 'audio_dialogue', 'social_clip', 'videocolumna', 'animated_infographic')),
  r2_key TEXT,
  transcript_vtt_key TEXT,
  duration_s REAL,
  source_hash TEXT,
  script_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'ready', 'failed')),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  cue_map_json TEXT,
  bytes INTEGER,
  UNIQUE(entity_type, entity_id, locale, kind)
);

INSERT INTO media_assets_new
  (id, entity_type, entity_id, locale, kind, r2_key, transcript_vtt_key, duration_s,
   source_hash, script_text, status, error, created_at, updated_at, cue_map_json, bytes)
SELECT
   id, entity_type, entity_id, locale, kind, r2_key, transcript_vtt_key, duration_s,
   source_hash, script_text, status, error, created_at, updated_at, cue_map_json, bytes
FROM media_assets;

DROP TABLE media_assets;
ALTER TABLE media_assets_new RENAME TO media_assets;

CREATE INDEX idx_media_assets_entity ON media_assets(entity_type, entity_id);
CREATE INDEX idx_media_assets_status ON media_assets(status);

PRAGMA foreign_keys = ON;

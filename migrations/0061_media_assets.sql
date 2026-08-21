-- Generated media (narrated audio first; later social clips, videocolumnas, animated
-- infographics) for columns and investigaciones. Deliberately ONE generic table keyed by
-- (entity_type, entity_id, locale, kind) instead of columns bolted onto `columns` and
-- `investigaciones`: the same piece can have several media variants per locale, and neither
-- content table has any audio/video column today, so there's nothing to migrate.
--
-- `source_hash` is what makes regeneration cheap and safe: it's a hash of the adapted script
-- that produced the asset, so an edit to the article only invalidates what actually changed
-- (ElevenLabs bills per character, and the per-paragraph R2 cache lives alongside this).
--
-- `script_text` is stored so alignment/captions and a re-render can run without paying for
-- the LLM adaptation a second time.
CREATE TABLE media_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('columna', 'investigacion')),
  entity_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('audio_narration', 'social_clip', 'videocolumna', 'animated_infographic')),
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
  UNIQUE(entity_type, entity_id, locale, kind)
);

CREATE INDEX idx_media_assets_entity ON media_assets(entity_type, entity_id);
CREATE INDEX idx_media_assets_status ON media_assets(status);

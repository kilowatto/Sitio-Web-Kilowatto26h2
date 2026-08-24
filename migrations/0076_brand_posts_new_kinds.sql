-- Opens brand_posts to the rest of the system.
--
-- Until now the table could only describe four things, none of which were a column or an audio
-- episode: 20 published columns generated no posts at all, and the podcast launched into two
-- directories without the post system noticing. It also had investigacion_id but no column_id,
-- so there was nowhere to point even if the kind had existed.
--
-- All four new kinds and both new columns land in one rebuild. SQLite cannot alter a CHECK
-- constraint, and doing this twice would mean copying 767 rows twice.
--
-- Column order and every constraint below must match the live table exactly -- a silently
-- dropped column here would take posted history, scheduling and engagement links with it.

PRAGMA foreign_keys = OFF;

CREATE TABLE brand_posts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK (platform IN ('x', 'linkedin')),
  kind TEXT NOT NULL CHECK (kind IN (
    'news_reshare', 'idea', 'news_reaction', 'investigacion_highlight',
    -- New:
    'columna_highlight',   -- a published column, finally announced
    'audio_highlight',     -- a narration or a podcast episode being ready
    'subscription_cta',    -- "subscribe to the podcast", spaced or after a download spike
    'clip'                 -- a vertical video clip; see docs/sprint-fase3-4.md
  )),
  topic_id INTEGER REFERENCES brand_topics(id),
  investigacion_id INTEGER REFERENCES investigaciones(id),
  column_id INTEGER REFERENCES columns(id),
  language TEXT NOT NULL,
  content TEXT NOT NULL,
  original_content TEXT,
  source_url TEXT,
  image_r2_key TEXT,
  video_r2_key TEXT,
  variant_group TEXT,
  variant_style TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'rejected', 'posted', 'failed', 'expired')),
  rejection_reason TEXT,
  scheduled_for TEXT,
  approved_at TEXT,
  posted_at TEXT,
  external_post_id TEXT,
  external_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  hashtags TEXT,
  sources TEXT,
  idea_prompt TEXT,
  feedback_recorded INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  auto_published INTEGER NOT NULL DEFAULT 0,
  never_auto INTEGER NOT NULL DEFAULT 0,
  image_style TEXT
);

INSERT INTO brand_posts_new
  (id, platform, kind, topic_id, investigacion_id, language, content, original_content,
   source_url, image_r2_key, variant_group, variant_style, status, rejection_reason,
   scheduled_for, approved_at, posted_at, external_post_id, external_url, created_at,
   hashtags, sources, idea_prompt, feedback_recorded, expires_at, auto_published,
   never_auto, image_style)
SELECT
   id, platform, kind, topic_id, investigacion_id, language, content, original_content,
   source_url, image_r2_key, variant_group, variant_style, status, rejection_reason,
   scheduled_for, approved_at, posted_at, external_post_id, external_url, created_at,
   hashtags, sources, idea_prompt, feedback_recorded, expires_at, auto_published,
   never_auto, image_style
FROM brand_posts;

DROP TABLE brand_posts;
ALTER TABLE brand_posts_new RENAME TO brand_posts;

-- The four that existed, recreated verbatim, plus two the new columns need.
CREATE INDEX idx_brand_posts_status ON brand_posts(status);
CREATE INDEX idx_brand_posts_platform ON brand_posts(platform);
CREATE INDEX idx_brand_posts_expires ON brand_posts(expires_at);
CREATE INDEX idx_brand_posts_investigacion ON brand_posts(investigacion_id);
CREATE INDEX idx_brand_posts_column ON brand_posts(column_id);
CREATE INDEX idx_brand_posts_scheduled ON brand_posts(scheduled_for);

PRAGMA foreign_keys = ON;

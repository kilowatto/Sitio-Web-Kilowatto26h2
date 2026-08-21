-- Supports the full investigacion production pipeline decided 2026-08-21:
-- an admin approval queue (mirrors columns' pending_approval/rejection_reason
-- -- investigaciones.status has no CHECK constraint so this is a plain ADD),
-- and a batch of 24-48 scheduled social posts per published piece.

ALTER TABLE investigaciones ADD COLUMN rejection_reason TEXT;

-- SQLite can't ALTER a CHECK constraint, so brand_posts is rebuilt to add
-- 'investigacion_highlight' to `kind` -- same reasoning/pattern as
-- migrations/0015_news_reactions.sql when 'news_reaction' was added.
PRAGMA foreign_keys=OFF;

CREATE TABLE brand_posts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK (platform IN ('x', 'linkedin')),
  kind TEXT NOT NULL CHECK (kind IN ('news_reshare', 'idea', 'news_reaction', 'investigacion_highlight')),
  topic_id INTEGER REFERENCES brand_topics(id),
  investigacion_id INTEGER REFERENCES investigaciones(id),
  language TEXT NOT NULL,
  content TEXT NOT NULL,
  original_content TEXT,
  source_url TEXT,
  image_r2_key TEXT,
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
  never_auto INTEGER NOT NULL DEFAULT 0
);

INSERT INTO brand_posts_new (
  id, platform, kind, topic_id, language, content, original_content, source_url, image_r2_key,
  variant_group, variant_style, status, rejection_reason, scheduled_for, approved_at, posted_at,
  external_post_id, external_url, created_at, hashtags, sources, idea_prompt, feedback_recorded,
  expires_at, auto_published, never_auto
)
SELECT
  id, platform, kind, topic_id, language, content, original_content, source_url, image_r2_key,
  variant_group, variant_style, status, rejection_reason, scheduled_for, approved_at, posted_at,
  external_post_id, external_url, created_at, hashtags, sources, idea_prompt, feedback_recorded,
  expires_at, auto_published, never_auto
FROM brand_posts;

DROP TABLE brand_posts;
ALTER TABLE brand_posts_new RENAME TO brand_posts;

PRAGMA foreign_keys=ON;

-- Re-create every index the dropped table carried (lost on DROP TABLE), plus
-- the new one for this migration.
CREATE INDEX idx_brand_posts_status ON brand_posts(status);
CREATE INDEX idx_brand_posts_platform ON brand_posts(platform);
CREATE INDEX idx_brand_posts_expires ON brand_posts(expires_at);
CREATE INDEX idx_brand_posts_investigacion ON brand_posts(investigacion_id);

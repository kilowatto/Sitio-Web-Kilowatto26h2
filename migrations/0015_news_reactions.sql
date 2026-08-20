-- News-reaction posts: real tech news Larry finds and reacts to in Esteban's voice.
-- Needs a genuinely new `kind` (not reusing 'idea' — this has its own expiry/trust/auto-
-- publish lifecycle that would be confusing to mix with idea-compositor posts) and a new
-- `status` value ('expired'). SQLite can't ALTER a CHECK constraint, so the table is
-- recreated — same reasoning documented earlier for why 'historical_import' reused 'idea'
-- instead of doing this; this time the new category is permanent enough to justify it.
PRAGMA foreign_keys=OFF;

CREATE TABLE brand_posts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK (platform IN ('x', 'linkedin')),
  kind TEXT NOT NULL CHECK (kind IN ('news_reshare', 'idea', 'news_reaction')),
  topic_id INTEGER REFERENCES brand_topics(id),
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
  external_post_id, external_url, created_at, hashtags, sources, idea_prompt, feedback_recorded
)
SELECT
  id, platform, kind, topic_id, language, content, original_content, source_url, image_r2_key,
  variant_group, variant_style, status, rejection_reason, scheduled_for, approved_at, posted_at,
  external_post_id, external_url, created_at, hashtags, sources, idea_prompt, feedback_recorded
FROM brand_posts;

DROP TABLE brand_posts;
ALTER TABLE brand_posts_new RENAME TO brand_posts;

CREATE INDEX idx_brand_posts_status ON brand_posts(status);
CREATE INDEX idx_brand_posts_platform ON brand_posts(platform);
CREATE INDEX idx_brand_posts_expires ON brand_posts(expires_at);

PRAGMA foreign_keys=ON;

-- Curated media allow-list (editable from /admin/social) — search results are filtered to
-- only these outlets by name match, seeded with ~50 recognized tech/business sources across
-- English and Spanish/LatAm. `trusted=0` means "keep in the list but never use" (soft
-- blacklist per Esteban's call) rather than deleting, so the seed stays a reference.
CREATE TABLE news_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  domain TEXT,
  trusted INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_news_sources_trusted ON news_sources(trusted);

INSERT INTO news_sources (name, domain) VALUES
  ('TechCrunch', 'techcrunch.com'),
  ('The Verge', 'theverge.com'),
  ('Wired', 'wired.com'),
  ('Ars Technica', 'arstechnica.com'),
  ('Engadget', 'engadget.com'),
  ('VentureBeat', 'venturebeat.com'),
  ('ZDNET', 'zdnet.com'),
  ('CNET', 'cnet.com'),
  ('MIT Technology Review', 'technologyreview.com'),
  ('IEEE Spectrum', 'spectrum.ieee.org'),
  ('The Information', 'theinformation.com'),
  ('Axios', 'axios.com'),
  ('Bloomberg', 'bloomberg.com'),
  ('Reuters', 'reuters.com'),
  ('Financial Times', 'ft.com'),
  ('Business Insider', 'businessinsider.com'),
  ('Fast Company', 'fastcompany.com'),
  ('Fortune', 'fortune.com'),
  ('Forbes', 'forbes.com'),
  ('The Register', 'theregister.com'),
  ('InfoWorld', 'infoworld.com'),
  ('Data Center Knowledge', 'datacenterknowledge.com'),
  ('SiliconANGLE', 'siliconangle.com'),
  ('Protocol', 'protocol.com'),
  ('Stratechery', 'stratechery.com'),
  ('CRN', 'crn.com'),
  ('Network World', 'networkworld.com'),
  ('Computerworld', 'computerworld.com'),
  ('Xataka', 'xataka.com'),
  ('Xataka México', 'xataka.com.mx'),
  ('Hipertextual', 'hipertextual.com'),
  ('Genbeta', 'genbeta.com'),
  ('Wwwhatsnew', 'wwwhatsnew.com'),
  ('El Economista', 'eleconomista.com.mx'),
  ('Expansión', 'expansion.mx'),
  ('Forbes México', 'forbes.com.mx'),
  ('Infobae', 'infobae.com'),
  ('El Universal', 'eluniversal.com.mx'),
  ('Milenio', 'milenio.com'),
  ('Reforma', 'reforma.com'),
  ('América Retail', 'america-retail.com'),
  ('Contxto', 'contxto.com'),
  ('Rest of World', 'restofworld.org'),
  ('LABS', 'labsnews.com'),
  ('Merca2.0', 'merca20.com'),
  ('TICbeat', 'ticbeat.com'),
  ('La Nación', 'lanacion.com.ar'),
  ('El Tiempo', 'eltiempo.com'),
  ('El País Tecnología', 'elpais.com'),
  ('La Vanguardia', 'lavanguardia.com'),
  ('Muy Interesante', 'muyinteresante.com');

-- Per-platform "has this learned enough to publish news reactions on its own" counter.
-- consecutive_clean_approvals resets to 0 on any edit-before-approve or reject of a
-- news_reaction post; autopilot_enabled flips on automatically at the threshold (10) and
-- can be manually switched back off (the dedicated panic switch), which also resets the
-- counter so it has to re-earn trust rather than instantly re-triggering next tick.
CREATE TABLE news_reaction_trust (
  platform TEXT PRIMARY KEY CHECK (platform IN ('x', 'linkedin')),
  consecutive_clean_approvals INTEGER NOT NULL DEFAULT 0,
  autopilot_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO news_reaction_trust (platform) VALUES ('x'), ('linkedin');

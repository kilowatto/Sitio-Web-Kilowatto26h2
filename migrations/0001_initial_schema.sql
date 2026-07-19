-- Core data model for kilowatto.com
-- See docs/site_architecture (memory) and docs/*.md for the content this seeds from.

CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT UNIQUE NOT NULL,
  caption TEXT,
  ai_caption TEXT,
  album TEXT,
  taken_date TEXT,
  taken_city TEXT,
  minor_flag TEXT NOT NULL DEFAULT 'pending',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT
);

CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  full_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  nickname TEXT,
  birth_date TEXT,
  birth_place TEXT,
  bio_short TEXT,
  photo_id INTEGER REFERENCES photos(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  start_date TEXT,
  end_date TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  website_url TEXT,
  logo_photo_id INTEGER REFERENCES photos(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  summary TEXT,
  website_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_date TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  related_company_id INTEGER REFERENCES companies(id),
  related_investment_id INTEGER REFERENCES investments(id),
  source_type TEXT NOT NULL DEFAULT 'self',
  source_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE press_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,
  outlet TEXT,
  title TEXT,
  published_at TEXT,
  summary TEXT,
  identity_confidence TEXT NOT NULL DEFAULT 'pending',
  raw_content_r2_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT
);

CREATE TABLE social_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  external_id TEXT,
  url TEXT,
  content TEXT,
  posted_at TEXT,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(platform, external_id)
);

CREATE TABLE family_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  nickname TEXT,
  relationship TEXT NOT NULL,
  birth_date TEXT,
  birth_place TEXT,
  death_date TEXT,
  bio TEXT,
  photo_id INTEGER REFERENCES photos(id),
  parent_1_id INTEGER REFERENCES family_members(id),
  parent_2_id INTEGER REFERENCES family_members(id),
  is_public_figure INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  entity_type TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  link_type TEXT,
  internal_path TEXT,
  source TEXT NOT NULL DEFAULT 'wikidata',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  field_key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai',
  reviewed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity_type, entity_id, locale, field_key)
);

CREATE INDEX idx_translations_lookup ON translations(entity_type, entity_id, locale);
CREATE INDEX idx_timeline_date ON timeline_events(event_date);
CREATE INDEX idx_press_status ON press_mentions(status);
CREATE INDEX idx_photos_approval ON photos(approval_status);
CREATE INDEX idx_entities_approval ON entities(approval_status);

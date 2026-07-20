-- Personal brand automation: AI-drafted posts for X/LinkedIn, approval queue,
-- engagement metrics (feeds Analytics Engine + this table), A/B variants, push subs.

CREATE TABLE brand_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE brand_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK (platform IN ('x', 'linkedin')),
  kind TEXT NOT NULL CHECK (kind IN ('news_reshare', 'idea')),
  topic_id INTEGER REFERENCES brand_topics(id),
  language TEXT NOT NULL,
  content TEXT NOT NULL,
  original_content TEXT,
  source_url TEXT,
  image_r2_key TEXT,
  variant_group TEXT,
  variant_style TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'rejected', 'posted', 'failed')),
  rejection_reason TEXT,
  scheduled_for TEXT,
  approved_at TEXT,
  posted_at TEXT,
  external_post_id TEXT,
  external_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_brand_posts_status ON brand_posts(status);
CREATE INDEX idx_brand_posts_platform ON brand_posts(platform);

CREATE TABLE brand_post_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_post_id INTEGER NOT NULL REFERENCES brand_posts(id),
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  impressions INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE brand_comment_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_post_id INTEGER NOT NULL REFERENCES brand_posts(id),
  platform_comment_id TEXT NOT NULL,
  commenter TEXT,
  comment_text TEXT,
  suggested_reply TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'posted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(brand_post_id, platform_comment_id)
);

CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO brand_topics (label, description, sort_order) VALUES
  ('Yucatech Festival y comunidad tech', 'Todo lo relacionado al festival y eventos de comunidad tech en Yucatán.', 1),
  ('Cloud, edge computing e IA', 'Ignia Cloud, tendencias de infraestructura, Nvidia, Meta Llama, Anthropic, LLMs.', 2),
  ('Founders LATAM y lecciones de negocio', 'Trayectoria construyendo y vendiendo empresas, exits, aprendizajes.', 3),
  ('Angel investing y Orange Rhino', 'Perspectivas como inversionista — nunca lenguaje de asesoría/consejo de inversión.', 4),
  ('Curling', 'Resultados y datos recientes de partidos de curling.', 5),
  ('Pumas UNAM', 'Solo para celebrar triunfos — nunca enojo o crítica cuando pierden. Nada más de fútbol.', 6);

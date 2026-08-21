-- "A fondo" -- deep-research pieces, sister to columns but written by Esteban himself
-- (not AI-generated end to end) and far longer/more source-heavy. See
-- docs/investigaciones-spec.md for the full feature spec.

CREATE TABLE investigaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  hook TEXT,
  summary TEXT NOT NULL,
  body_html TEXT NOT NULL,
  methodology_html TEXT,
  read_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  cover_r2_key TEXT,
  share_r2_key TEXT,
  og_r2_key TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  display_seed INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_investigaciones_status ON investigaciones(status, published_at);

-- Every citation gets its own kilowatto.com/r/xxxx short link (via short_links,
-- same mechanism brand posts already use) so click tracking per source is free.
CREATE TABLE investigacion_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investigacion_id INTEGER NOT NULL REFERENCES investigaciones(id),
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'green',
  short_link_id INTEGER REFERENCES short_links(id)
);

CREATE INDEX idx_investigacion_sources_investigacion ON investigacion_sources(investigacion_id, position);

-- Chart data lives here as structured JSON, not as generated images -- rendered by
-- reusable Astro components (src/lib/investigacion-charts.ts) into hand-coded SVG,
-- same reasoning as column-infographic.ts: image models can't render legible
-- text/numbers reliably.
CREATE TABLE investigacion_charts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investigacion_id INTEGER NOT NULL REFERENCES investigaciones(id),
  chart_key TEXT NOT NULL,
  chart_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  data_json TEXT NOT NULL,
  source_note TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_investigacion_charts_investigacion ON investigacion_charts(investigacion_id, position);

ALTER TABLE short_links ADD COLUMN investigacion_id INTEGER REFERENCES investigaciones(id);

-- Comments reuse the same table as columns. column_id must become nullable since a
-- comment now belongs to exactly one of column_id/investigacion_id -- SQLite can't
-- relax a NOT NULL with a plain ALTER, so rebuild the table.
CREATE TABLE comments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id INTEGER REFERENCES columns(id),
  investigacion_id INTEGER REFERENCES investigaciones(id),
  author_name TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  flagged_reason TEXT,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO comments_new (id, column_id, author_name, body, status, flagged_reason, ip_hash, user_agent, rejection_reason, created_at)
SELECT id, column_id, author_name, body, status, flagged_reason, ip_hash, user_agent, rejection_reason, created_at FROM comments;

DROP TABLE comments;
ALTER TABLE comments_new RENAME TO comments;

CREATE INDEX idx_comments_column ON comments(column_id, status);
CREATE INDEX idx_comments_investigacion ON comments(investigacion_id, status);
CREATE INDEX idx_comments_ip_hash ON comments(ip_hash);
CREATE INDEX idx_comments_status ON comments(status, created_at);

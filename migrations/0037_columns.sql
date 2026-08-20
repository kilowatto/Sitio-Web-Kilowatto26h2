-- Esteban's own opinion columns (tech/AI takes he writes under @Kilowatto) — original
-- first-person content, distinct from press_mentions (external coverage ABOUT him) and
-- books (his reading library). No status/approval column: these arrive already finished,
-- he hands them over to publish directly, unlike the brand-automation drafts queue.
CREATE TABLE columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  body_html TEXT NOT NULL,
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_columns_published_at ON columns(published_at);

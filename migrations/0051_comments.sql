CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id INTEGER NOT NULL REFERENCES columns(id),
  author_name TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  flagged_reason TEXT,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_comments_column ON comments(column_id, status);
CREATE INDEX idx_comments_ip_hash ON comments(ip_hash);
CREATE INDEX idx_comments_status ON comments(status, created_at);

CREATE TABLE comment_bans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

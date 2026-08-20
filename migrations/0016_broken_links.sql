-- Logs every 404 hit so Esteban can see which broken/old URLs are actually getting traffic
-- and decide which deserve a real redirect, instead of guessing.
CREATE TABLE broken_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  referrer TEXT,
  hit_count INTEGER NOT NULL DEFAULT 1,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(path)
);

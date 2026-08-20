-- Advanced search from /admin/prensa: each search Esteban runs is saved here and gets
-- re-run automatically by the weekly Brave Search cron until he deletes it.
CREATE TABLE press_saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  include_terms TEXT NOT NULL,
  exclude_terms TEXT NOT NULL DEFAULT '[]',
  global_scope INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_run_at TEXT,
  UNIQUE(include_terms, exclude_terms, global_scope)
);

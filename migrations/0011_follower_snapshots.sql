-- Daily follower-count snapshots, for the reports dashboard's growth chart. LinkedIn has no
-- reliable personal-profile follower-count endpoint under the basic w_member_social/openid
-- scopes (that's an Organization-only field in their API) — X only for now, honestly.
CREATE TABLE follower_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  followers INTEGER NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

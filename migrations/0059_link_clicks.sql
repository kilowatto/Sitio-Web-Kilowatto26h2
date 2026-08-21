-- Rich per-click detail for kilowatto.com/r/xxxx short links, requested 2026-08-21:
-- Esteban wants maximum available detail per click (full IP, browser, device, geo,
-- screen/viewport, referrer, timestamp), not just the existing short_links.clicks
-- counter. Server-side fields (ip, geo, UA, referrer) are always captured on the
-- redirect itself; screen/viewport fields only arrive if the client's JS beacon
-- fires (see src/pages/r/[slug].ts and src/pages/api/track-click-client.ts),
-- so those columns are nullable.
CREATE TABLE link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  short_link_id INTEGER NOT NULL REFERENCES short_links(id),
  clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  timezone TEXT,
  colo TEXT,
  asn INTEGER,
  as_organization TEXT,
  user_agent TEXT,
  is_mobile INTEGER NOT NULL DEFAULT 0,
  referrer TEXT,
  language TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  viewport_width INTEGER,
  viewport_height INTEGER,
  device_pixel_ratio REAL
);

CREATE INDEX idx_link_clicks_short_link ON link_clicks(short_link_id);
CREATE INDEX idx_link_clicks_clicked_at ON link_clicks(clicked_at);

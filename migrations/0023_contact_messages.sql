-- Submissions from the new /contacto form. Reviewed manually in /admin — no auto-reply,
-- no email sending infra required (Turnstile/Cloudflare Email Routing are separate,
-- not-yet-configured pieces; this just needs a place to land safely).
CREATE TABLE contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

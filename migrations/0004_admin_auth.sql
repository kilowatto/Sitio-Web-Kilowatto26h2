-- Real single-user auth for /admin (replaces the shared-link ADMIN_TOKEN as the
-- human-facing gate — ADMIN_TOKEN itself stays as the internal secret the now-
-- authenticated pages use to call their own API endpoints, unchanged).

CREATE TABLE users (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE webauthn_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_type TEXT,
  backed_up INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  nickname TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);

-- Encrypted (AES-GCM) storage for the X/LinkedIn API credentials, editable from
-- /admin/settings — a Worker can't call `wrangler secret put` on itself, so these
-- can't be real Wrangler secrets if they need to be settable from a web form.
CREATE TABLE brand_api_settings (
  key TEXT PRIMARY KEY,
  encrypted_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

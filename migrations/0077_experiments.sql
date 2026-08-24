-- Measuring which knobs actually work, instead of deciding by ear.
--
-- Esteban's answer when asked how a winner gets picked was "sistema con umbral": not "whichever
-- number is bigger today", which on five posts a week is mostly noise. So an experiment carries
-- its own two thresholds -- a minimum sample per arm and a minimum lift over the runner-up --
-- and stays undecided until both are met. It is the difference between a measurement and a
-- coin flip with extra steps.
--
-- Three tables rather than a column on brand_posts, because the same machinery has to cover
-- audio too ("mismo sistema para audio"): a subject is a brand_posts row OR a media_assets row,
-- and the outcome is read from whatever that surface records -- clicks for a post, downloads for
-- an episode.

CREATE TABLE experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  -- Which pipeline assigns arms, and therefore which outcome table gets read.
  surface TEXT NOT NULL CHECK (surface IN ('post', 'clip', 'audio')),
  description TEXT,
  -- Per arm, not total. Five posts a week means six weeks to get five per arm on a two-arm
  -- experiment, which is exactly the cadence Esteban set.
  min_sample INTEGER NOT NULL DEFAULT 5,
  -- How much better the leader has to be before it counts as a winner. 0.20 = 20% above the
  -- runner-up. Anything smaller is inside the noise at this sample size.
  min_lift REAL NOT NULL DEFAULT 0.20,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'decided', 'paused')),
  winner TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE experiment_arms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id INTEGER NOT NULL REFERENCES experiments(id),
  arm TEXT NOT NULL,
  -- The actual knobs, so a result can be reproduced a month later. Nothing hardcoded elsewhere.
  config_json TEXT,
  UNIQUE (experiment_id, arm)
);

CREATE TABLE experiment_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id INTEGER NOT NULL REFERENCES experiments(id),
  arm TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('brand_post', 'media_asset')),
  subject_id INTEGER NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- One subject, one arm, forever. Reassigning a post that already went out would attribute its
  -- clicks to the wrong knob.
  UNIQUE (experiment_id, subject_type, subject_id)
);

CREATE INDEX idx_experiment_assignments_subject ON experiment_assignments(subject_type, subject_id);
CREATE INDEX idx_experiment_assignments_exp ON experiment_assignments(experiment_id, arm);

-- The three questions worth asking first, seeded so the pipelines have something to read from
-- day one. Each one is a real fork in the code, not a hypothetical.
INSERT INTO experiments (key, surface, description, min_sample, min_lift) VALUES
  ('clip_duration', 'clip',
   '¿30 o 75 segundos? Un clip corto se ve entero; uno largo alcanza a contar el dato.', 5, 0.20),
  ('clip_hook', 'clip',
   '¿El gancho abre con una pregunta (Veritasium) o con la cifra en seco?', 5, 0.20),
  ('audio_kind', 'audio',
   '¿La conversación o la lectura completa? La conversación cuesta más y debería ganar.', 5, 0.20);

-- One statement per arm: SQLite caps the number of terms in a compound SELECT, and a six-way
-- UNION ALL is already past it on D1.
INSERT INTO experiment_arms (experiment_id, arm, config_json)
  SELECT id, '30s', '{"durationSeconds":30}' FROM experiments WHERE key = 'clip_duration';
INSERT INTO experiment_arms (experiment_id, arm, config_json)
  SELECT id, '75s', '{"durationSeconds":75}' FROM experiments WHERE key = 'clip_duration';
INSERT INTO experiment_arms (experiment_id, arm, config_json)
  SELECT id, 'pregunta', '{"hookStyle":"question"}' FROM experiments WHERE key = 'clip_hook';
INSERT INTO experiment_arms (experiment_id, arm, config_json)
  SELECT id, 'cifra', '{"hookStyle":"number"}' FROM experiments WHERE key = 'clip_hook';
INSERT INTO experiment_arms (experiment_id, arm, config_json)
  SELECT id, 'conversacion', '{"kind":"audio_dialogue"}' FROM experiments WHERE key = 'audio_kind';
INSERT INTO experiment_arms (experiment_id, arm, config_json)
  SELECT id, 'lectura', '{"kind":"audio_narration"}' FROM experiments WHERE key = 'audio_kind';

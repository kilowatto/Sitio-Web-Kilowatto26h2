-- Manual profile-photo override (auto-rotation via solo_subject stays the default;
-- this lets Esteban mark specific photos to take priority), simple person tagging with
-- autocomplete, and support for AI-polished + translated captions (translations table
-- already exists generically, this just gives photos a field_key='caption' to use it).

ALTER TABLE photos ADD COLUMN is_profile_photo INTEGER DEFAULT 0;

CREATE TABLE people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE photo_people (
  photo_id INTEGER NOT NULL REFERENCES photos(id),
  person_id INTEGER NOT NULL REFERENCES people(id),
  PRIMARY KEY (photo_id, person_id)
);

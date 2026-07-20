-- Marks photos where exactly one person appears (used for the homepage hero rotation —
-- Esteban wants only solo photos of himself, not group shots, pulled from his own gallery).
ALTER TABLE photos ADD COLUMN solo_subject INTEGER DEFAULT 0;

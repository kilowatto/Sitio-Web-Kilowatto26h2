-- Family tree page removed (privacy) — drop the underlying data, not just the page.
DELETE FROM translations WHERE entity_type = 'family_members';
DROP TABLE IF EXISTS family_members;

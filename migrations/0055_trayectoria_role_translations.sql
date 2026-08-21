-- Translate the two company `role` values that are new/changed since the
-- parallel-timeline redesign (0054), so the homepage timeline reads
-- correctly in every non-Spanish locale. Spanish locale variants
-- (es-AR/es-CO/es-ES/es-419) intentionally have no rows here -- they fall
-- back to the canonical Spanish value via t(), matching how this table
-- already treats unchanged fields.
--
-- entity_id 10 = desici-consejero (role: "Consejero")
-- entity_id 8  = cereza (role: "Fundador y Consejero")

INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source)
VALUES
  ('companies', 10, 'en', 'role', 'Board Advisor', 'human'),
  ('companies', 10, 'pt-BR', 'role', 'Conselheiro', 'human'),
  ('companies', 10, 'fr', 'role', 'Conseiller', 'human'),
  ('companies', 10, 'de', 'role', 'Berater', 'human'),
  ('companies', 10, 'ar', 'role', 'مستشار', 'human'),
  ('companies', 10, 'zh-Hans', 'role', '顾问', 'human'),
  ('companies', 10, 'ja', 'role', '顧問', 'human'),
  ('companies', 8, 'en', 'role', 'Founder and Board Advisor', 'human'),
  ('companies', 8, 'pt-BR', 'role', 'Fundador e Conselheiro', 'human'),
  ('companies', 8, 'fr', 'role', 'Fondateur et conseiller', 'human'),
  ('companies', 8, 'de', 'role', 'Gründer und Berater', 'human'),
  ('companies', 8, 'ar', 'role', 'مؤسس ومستشار', 'human'),
  ('companies', 8, 'zh-Hans', 'role', '创始人兼顾问', 'human'),
  ('companies', 8, 'ja', 'role', '創業者兼顧問', 'human')
ON CONFLICT (entity_type, entity_id, locale, field_key) DO UPDATE SET
  value = excluded.value,
  source = excluded.source,
  reviewed = 0;

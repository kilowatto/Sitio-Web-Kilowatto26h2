-- Support showing concurrent/overlapping roles as parallel lanes in the
-- homepage "Trayectoria" timeline, and split Desici's founder era from its
-- later advisory-only phase.

ALTER TABLE companies ADD COLUMN is_advisory INTEGER NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN show_in_timeline INTEGER NOT NULL DEFAULT 1;

-- Desici: close the founder-operator phase in 2016, trim the summary to
-- that era; the "hoy opera bajo Roberto" sentence now describes the
-- consejero-only row below.
UPDATE companies
SET end_date = '2016',
    is_current = 0,
    summary = 'Desarrollo de software y consultoría de procesos; partner autorizado de Zoho (CRM, Books). Nace del hartazgo de trabajar para alguien más.'
WHERE slug = 'desici';

INSERT INTO companies (slug, name, role, start_date, end_date, is_current, is_advisory, summary, website_url, sort_order)
VALUES (
  'desici-consejero',
  'DeSiCi (Desarrollo de Sistemas Corporativos en Internet)',
  'Consejero',
  '2016', NULL, 1, 1,
  'Hoy opera bajo la dirección de Roberto (CEO), con supervisión ocasional de Esteban.',
  'https://desici.com',
  9
);

-- Cereza: founder/board seat, not a day-to-day operational role.
UPDATE companies
SET role = 'Fundador y Consejero',
    is_advisory = 1
WHERE slug = 'cereza';

-- Octapus: keep the historical record, just leave it out of the visual
-- timeline for now.
UPDATE companies SET show_in_timeline = 0 WHERE slug = 'octapus';

INSERT INTO companies (slug, name, role, start_date, end_date, is_current, is_advisory, summary, website_url, sort_order)
VALUES (
  'orange-rhino',
  'Orange Rhino Investments',
  'CEO & Chief Coffee Maker',
  '2021', NULL, 1, 0,
  NULL, NULL, 10
);

INSERT INTO companies (slug, name, role, start_date, end_date, is_current, is_advisory, summary, website_url, sort_order)
VALUES (
  'pilou',
  'Pilou',
  'CTO',
  '2024-12', '2026-01', 0, 0,
  NULL, NULL, 11
);

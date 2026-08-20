-- "Mis proyectos": a self-updating directory of Esteban's live projects, distinct from the
-- historical `companies` timeline. A weekly cron (see scripts/make-scheduled-entry.mjs +
-- src/lib/projects-refresh.ts) fetches each url, refreshes `summary` from the real page
-- content, and flips is_reachable off/on automatically — never manually curated after seeding.
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  role TEXT,
  summary TEXT,
  is_reachable INTEGER NOT NULL DEFAULT 1,
  last_checked_at TEXT,
  last_ok_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO projects (slug, name, url, role, summary, is_reachable, last_checked_at, last_ok_at, sort_order) VALUES
  ('ignia-cloud', 'Ignia Cloud', 'https://www.ignia.cloud', 'Fundador y CEO',
   '"La Nube Naranja" — nube soberana e hiperpotente para México y LatAm, con arquitecturas híbridas/multicloud. 99.99% SLA, hasta 12M+ IOPS, 25 Gbps de red, hasta 80% de ahorro en costos de implementación. Partners: Microsoft, OpenStack, Dell Technologies, Cisco Systems, Acronis y Canonical. Oficinas en Ciudad de México y Magnolia, Texas.',
   1, datetime('now'), datetime('now'), 1),
  ('yucatech-festival', 'Yucatech Festival', 'https://kilowatto.com/yucatech', 'Fundador y patrocinador',
   'Festival de tecnología en Mérida, Yucatán — inteligencia artificial, ciberseguridad y nube, con capital real detrás de cada pitch en la "Elevator Pitch Hour". Primera edición: 16 de abril de 2026, más de 500 asistentes, con Uri Levine (cofundador de Waze) como ponente. Esteban lo financia de su bolsillo, sin fines de lucro.',
   1, datetime('now'), datetime('now'), 2),
  ('frida-cafe', 'Frida Café Artesanal', 'https://fridacafe.mx', NULL,
   'Café mexicano 100% orgánico certificado, cultivado en las tierras altas de México, en colaboración con la Familia Kahlo. "Más que café: un tributo al alma libre de México."',
   1, datetime('now'), datetime('now'), 3),
  ('cereza', 'Cereza', 'https://cereza.io', NULL,
   'Plataforma de software de Recursos Humanos todo-en-uno: estructura organizacional, asistencia y turnos, expedientes, evaluación de desempeño, reclutamiento, capacitación y clima laboral, para centralizar la gestión del capital humano en empresas medianas y grandes.',
   1, datetime('now'), datetime('now'), 4),
  ('vectron', 'Vectron', 'https://vectron.kilowatto.com', 'Creador',
   'Prototipo de visualización en WebGPU: renderiza en tiempo real miles de embeddings vectoriales de alta dimensión como un campo de partículas navegable — un experimento propio de cómputo GPU y datos vectoriales.',
   1, datetime('now'), datetime('now'), 5);

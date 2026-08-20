CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT,
  release_year TEXT,
  genre TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'fisico',
  summary TEXT,
  cover_r2_key TEXT,
  has_dedication INTEGER NOT NULL DEFAULT 0,
  dedication_text TEXT,
  dedication_from TEXT,
  dedication_r2_key TEXT,
  price_paid REAL,
  price_current REAL,
  price_checked_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO books (title, author, publisher, release_year, genre, summary, cover_r2_key, has_dedication, price_paid, sort_order) VALUES
('Operación Tucán', 'Edgar Hernández y Guadalupe Romero', 'Planeta', '1995', 'Crónica / investigación periodística',
 'El caso Colosio visto desde adentro: el asesinato de Luis Donaldo Colosio durante la campaña presidencial de 1994, sus implicaciones y sus terribles consecuencias.',
 'biblioteca/tucan.webp', 0, NULL, 10);

INSERT INTO books (title, author, publisher, release_year, genre, summary, cover_r2_key, has_dedication, price_paid, sort_order) VALUES
('La vida de Chuck', 'Stephen King', 'Debolsillo', '2025 (edición; historia original de 2020, en la colección "La sangre manda")', 'Ficción / fábula',
 'Una fábula profundamente fantástica, sincera y emocionante sobre la vida — base de la película del mismo nombre.',
 'biblioteca/chuck.webp', 0, NULL, 20);

INSERT INTO books (title, author, publisher, release_year, genre, summary, cover_r2_key, has_dedication, dedication_text, dedication_from, dedication_r2_key, price_paid, sort_order) VALUES
('La Democracia No Se Toca', 'Lorenzo Córdova y Ciro Murayama', 'Planeta', '2023', 'Ensayo político',
 'Notas que buscan explicar y defender la democracia mexicana, escritas por dos expresidentes/consejeros del INE.',
 'biblioteca/democracia.webp', 1,
 'Para Esteban, van estas notas que buscan explicar para poder defender a nuestra democracia, con el afecto y amistad de.',
 'Lorenzo Córdova V.',
 'biblioteca/democracia-dedicatoria.webp', NULL, 30);

INSERT INTO books (title, author, publisher, release_year, genre, summary, cover_r2_key, has_dedication, price_paid, price_current, price_checked_at, sort_order) VALUES
('Supremacía Cuántica', 'Michio Kaku', 'Debate', '2024', 'Divulgación científica / tecnología',
 'La revolución tecnológica de la computación cuántica: sus promesas y sus riesgos, y cómo cambiará todo, desde la energía hasta la medicina.',
 'biblioteca/kaku.webp', 0, 399.00, 279.00, '2026-07-26', 40);

INSERT INTO books (title, author, publisher, release_year, genre, summary, cover_r2_key, has_dedication, sort_order) VALUES
('Kakawa', 'Sin datos de edición confirmados', NULL, NULL, 'Historia / divulgación cultural',
 'Muchas historias, una sola raíz: el origen del cacao (kakaw / cacahoatl) y su legado que trasciende culturas.',
 'biblioteca/kakawa.webp', 0, 50);

INSERT INTO books (title, author, publisher, release_year, genre, summary, cover_r2_key, has_dedication, price_paid, sort_order) VALUES
('Los Tiempos Malditos', 'Francisco Martín Moreno', 'Alfaguara', '2025', 'Novela histórica',
 'Una relectura de la historia de la Conquista, escrita a raíz del debate sobre la exigencia de "perdón" de España a México.',
 'biblioteca/tiempos-malditos.webp', 0, 499.00, 60);

INSERT INTO books (title, author, publisher, release_year, genre, summary, cover_r2_key, has_dedication, sort_order) VALUES
('Lee Falk''s The Phantom: The Ghost Who Walks #2', 'Glenn Lumsden y Dave de Vries', 'Marvel Comics', '1995 (marzo)', 'Cómic',
 '"Heart of Darkness": el Phantom viaja de las calles de Nueva York a las montañas Ruwenzori de África para detener una toma corporativa.',
 'biblioteca/phantom.webp', 0, 70);

-- price_paid intentionally NULL: no price sticker visible on this copy's photo, unlike
-- Kaku/Tiempos Malditos where a real Sanborns sticker was legible. Don't assume paid == current.
INSERT INTO books (title, author, publisher, release_year, genre, summary, cover_r2_key, has_dedication, price_current, price_checked_at, sort_order) VALUES
('Código Fuente: Mis Inicios', 'Bill Gates', 'Plaza & Janés', '2025', 'Memoria / autobiografía',
 'El primer libro de memorias de Bill Gates: su infancia, sus primeros intereses y los proyectos que lo llevaron a convertirse en quien es hoy.',
 'biblioteca/gates.webp', 0, 399.00, '2026-07-26', 80);

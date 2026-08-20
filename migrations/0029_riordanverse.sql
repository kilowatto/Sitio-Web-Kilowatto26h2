-- Full Rick Riordan bibliography (Riordanverse), in recommended cross-series reading order.
-- status='tengo' = confirmed owned via photo Esteban sent; status='quiero' = wishlist, no cover.
-- Prices: only set where an actual price was confirmed (a real listing checked), left NULL otherwise
-- rather than guessed — see comments per row.

-- 1-5: Percy Jackson y los Dioses del Olimpo (owned, all 5 photographed)
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, cover_r2_key, summary, sort_order) VALUES
('Percy Jackson y los Dioses del Olimpo 1: El Ladrón del Rayo', 'Rick Riordan', 'Salamandra', '2005', 'Fantasía juvenil / mitología', 'Percy Jackson y los Dioses del Olimpo', 1, 'tengo', 'biblioteca/riordan-pj1.webp', 'El primer libro: Percy descubre que es hijo de Poseidón y debe recuperar el rayo maestro de Zeus.', 200),
('Percy Jackson y los Dioses del Olimpo 2: El Mar de los Monstruos', 'Rick Riordan', 'Salamandra', '2006', 'Fantasía juvenil / mitología', 'Percy Jackson y los Dioses del Olimpo', 2, 'tengo', 'biblioteca/riordan-pj2.webp', NULL, 201),
('Percy Jackson y los Dioses del Olimpo 3: La Maldición del Titán', 'Rick Riordan', 'Salamandra', '2007', 'Fantasía juvenil / mitología', 'Percy Jackson y los Dioses del Olimpo', 3, 'tengo', 'biblioteca/riordan-pj3.webp', NULL, 202),
('Percy Jackson y los Dioses del Olimpo 4: La Batalla del Laberinto', 'Rick Riordan', 'Salamandra', '2008', 'Fantasía juvenil / mitología', 'Percy Jackson y los Dioses del Olimpo', 4, 'tengo', 'biblioteca/riordan-pj4.webp', NULL, 203),
('Percy Jackson y los Dioses del Olimpo 5: El Último Héroe del Olimpo', 'Rick Riordan', 'Salamandra', '2009', 'Fantasía juvenil / mitología', 'Percy Jackson y los Dioses del Olimpo', 5, 'tengo', 'biblioteca/riordan-pj5.webp', NULL, 204);

-- 6: companion anthology (owned)
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, cover_r2_key, summary, sort_order) VALUES
('Percy Jackson y la Vara de Hermes & Otras Historias de Semidioses', 'Rick Riordan', 'Salamandra', NULL, 'Fantasía juvenil / mitología (relatos cortos)', 'Percy Jackson — complementario', 6, 'tengo', 'biblioteca/riordan-vara-hermes.webp', 'Colección de relatos cortos del Campamento Mestizo.', 205);

-- 7-11: Los Héroes del Olimpo (owned, all 5 photographed)
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, cover_r2_key, summary, sort_order) VALUES
('Los Héroes del Olimpo 1: El Héroe Perdido', 'Rick Riordan', 'Salamandra', '2010', 'Fantasía juvenil / mitología', 'Los Héroes del Olimpo', 7, 'tengo', 'biblioteca/riordan-hdo1.webp', 'La secuela directa de Percy Jackson — nuevos semidioses, romanos y griegos chocan.', 206),
('Los Héroes del Olimpo 2: El Hijo de Neptuno', 'Rick Riordan', 'Salamandra', '2011', 'Fantasía juvenil / mitología', 'Los Héroes del Olimpo', 8, 'tengo', 'biblioteca/riordan-hdo2.webp', NULL, 207),
('Los Héroes del Olimpo 3: La Marca de Atenea', 'Rick Riordan', 'Salamandra', '2012', 'Fantasía juvenil / mitología', 'Los Héroes del Olimpo', 9, 'tengo', 'biblioteca/riordan-hdo3.webp', NULL, 208),
('Los Héroes del Olimpo 4: La Casa de Hades', 'Rick Riordan', 'Salamandra', '2013', 'Fantasía juvenil / mitología', 'Los Héroes del Olimpo', 10, 'tengo', 'biblioteca/riordan-hdo4.webp', NULL, 209),
('Los Héroes del Olimpo 5: La Sangre del Olimpo', 'Rick Riordan', 'Salamandra', '2014', 'Fantasía juvenil / mitología', 'Los Héroes del Olimpo', 11, 'tengo', 'biblioteca/riordan-hdo5.webp', NULL, 210);

-- 12-14: Las Crónicas de Kane (wishlist — not owned yet)
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, sort_order) VALUES
('Las Crónicas de Kane 1: La Pirámide Roja', 'Rick Riordan', 'Salamandra', '2010', 'Fantasía juvenil / mitología', 'Las Crónicas de Kane', 12, 'quiero', 211),
('Las Crónicas de Kane 2: El Trono de Fuego', 'Rick Riordan', 'Salamandra', '2011', 'Fantasía juvenil / mitología', 'Las Crónicas de Kane', 13, 'quiero', 212),
('Las Crónicas de Kane 3: La Sombra de la Serpiente', 'Rick Riordan', 'Salamandra', '2012', 'Fantasía juvenil / mitología', 'Las Crónicas de Kane', 14, 'quiero', 213);

-- 15-16: extensión reciente de Percy Jackson (owned, both photographed)
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, cover_r2_key, summary, sort_order) VALUES
('Percy Jackson y el Cáliz de los Dioses', 'Rick Riordan', 'Salamandra', '2023', 'Fantasía juvenil / mitología', 'Percy Jackson y los Dioses del Olimpo', 15, 'tengo', 'biblioteca/riordan-pj6.webp', 'Percy, ya en la prepa, necesita cartas de recomendación de dioses griegos para entrar a Nueva Roma.', 214),
('Percy Jackson y la Diosa de Tres Cabezas', 'Rick Riordan', 'Salamandra', '2024', 'Fantasía juvenil / mitología', 'Percy Jackson y los Dioses del Olimpo', 16, 'tengo', 'biblioteca/riordan-pj7.webp', 'Segunda carta de recomendación: una misión de Hécate para Percy y Annabeth.', 215);

-- 17-19: Magnus Chase y los Dioses de Asgard (2 de 3 owned)
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, cover_r2_key, sort_order) VALUES
('Magnus Chase y los Dioses de Asgard 1: La Espada del Tiempo', 'Rick Riordan', 'Montena', '2015', 'Fantasía juvenil / mitología nórdica', 'Magnus Chase y los Dioses de Asgard', 17, 'tengo', 'biblioteca/riordan-mc1.webp', 216),
('Magnus Chase y los Dioses de Asgard 2: El Martillo de Thor', 'Rick Riordan', 'Montena', '2016', 'Fantasía juvenil / mitología nórdica', 'Magnus Chase y los Dioses de Asgard', 18, 'tengo', 'biblioteca/riordan-mc2.webp', 217);
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, sort_order) VALUES
('Magnus Chase y los Dioses de Asgard 3: El Barco de los Muertos', 'Rick Riordan', 'Montena', '2017', 'Fantasía juvenil / mitología nórdica', 'Magnus Chase y los Dioses de Asgard', 19, 'quiero', 218);

-- 20-25: Las Pruebas de Apolo (3 de 6 owned, incluida la novela corta 4.5)
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, cover_r2_key, sort_order) VALUES
('Las Pruebas de Apolo 1: El Oráculo Oculto', 'Rick Riordan', 'Salamandra', '2016', 'Fantasía juvenil / mitología', 'Las Pruebas de Apolo', 20, 'tengo', 'biblioteca/riordan-apolo1.webp', 219);
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, price_current, price_checked_at, sort_order) VALUES
('Las Pruebas de Apolo 2: La Profecía Oscura', 'Rick Riordan', 'Salamandra', '2017', 'Fantasía juvenil / mitología', 'Las Pruebas de Apolo', 21, 'quiero', 332.00, '2026-07-26', 220),
('Las Pruebas de Apolo 3: El Laberinto en Llamas', 'Rick Riordan', 'Salamandra', '2018', 'Fantasía juvenil / mitología', 'Las Pruebas de Apolo', 22, 'quiero', NULL, NULL, 221);
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, cover_r2_key, price_current, price_checked_at, sort_order) VALUES
('Las Pruebas de Apolo 4: La Tumba del Tirano', 'Rick Riordan', 'Salamandra', '2019', 'Fantasía juvenil / mitología', 'Las Pruebas de Apolo', 23, 'tengo', 'biblioteca/riordan-apolo4.webp', 389.00, '2026-07-26', 222);
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, price_current, price_checked_at, sort_order) VALUES
('Las Pruebas de Apolo 4.5: La Maldición del Campamento Júpiter', 'Rick Riordan', 'Salamandra', NULL, 'Fantasía juvenil / mitología (novela corta)', 'Las Pruebas de Apolo', 24, 'quiero', 249.00, '2026-07-26', 223);
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, cover_r2_key, sort_order) VALUES
('Las Pruebas de Apolo 5: La Torre de Nerón', 'Rick Riordan', 'Salamandra', '2020', 'Fantasía juvenil / mitología', 'Las Pruebas de Apolo', 25, 'tengo', 'biblioteca/riordan-apolo5.webp', 224);

-- 26: standalone reciente (wishlist)
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, sort_order) VALUES
('El Sol y la Estrella: Una Aventura de Nico di Angelo', 'Rick Riordan y Mark Oshiro', 'Salamandra', '2023', 'Fantasía juvenil / mitología', 'Percy Jackson — complementario', 26, 'quiero', 225);

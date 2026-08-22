-- 5 libros nuevos del universo de Riordan que no estaban en la lista de deseos original
-- (0029_riordanverse.sql sólo cubría las novelas numeradas): dos guías oficiales de
-- mitología (Kane, Magnus Chase x2), la continuación de la sub-serie de Nico di Angelo, y una
-- antología de "Rick Riordan Presents" con otros autores. Fotos rotadas 90° derecha, mismo
-- pipeline limpio ya establecido.
INSERT INTO books (title, author, genre, series, status, cover_r2_key, sort_order) VALUES
('Dioses Egipcios: La Guía Oficial de Las Crónicas de Kane', 'Rick Riordan', 'Fantasía juvenil / guía complementaria (mitología egipcia)', 'Las Crónicas de Kane — complementario', 'tengo', 'biblioteca/riordan-kane-guia.webp', 350);

INSERT INTO books (title, author, genre, series, status, cover_r2_key, sort_order) VALUES
('Héroes Nórdicos: La Guía Oficial del Universo de Magnus Chase', 'Rick Riordan', 'Fantasía juvenil / guía complementaria (mitología nórdica)', 'Magnus Chase y los Dioses de Asgard — complementario', 'tengo', 'biblioteca/riordan-magnus-guia1.webp', 351);

INSERT INTO books (title, author, genre, series, status, cover_r2_key, sort_order) VALUES
('Magnus Chase y los Dioses de Asgard: Los Nueve Mundos', 'Rick Riordan', 'Fantasía juvenil / guía complementaria (mitología nórdica)', 'Magnus Chase y los Dioses de Asgard — complementario', 'tengo', 'biblioteca/riordan-magnus-guia2.webp', 352);

INSERT INTO books (title, author, publisher, genre, series, reading_order, status, cover_r2_key, sort_order) VALUES
('La Corte de la Muerte', 'Rick Riordan y Mark Oshiro', 'Montena', 'Fantasía juvenil / mitología', 'Percy Jackson — complementario', 27, 'tengo', 'biblioteca/riordan-corte-muerte2.webp', 353);

-- Antología de "Rick Riordan Presents" con otros autores (mitología maya, filipina, coreana,
-- oeste-africana, entre otras) -- sin `series` (no pertenece a un solo panteón/sub-universo).
-- Precio: etiqueta de rebaja, "Ya cambié de $399 a $199".
INSERT INTO books (title, author, publisher, genre, status, cover_r2_key, price_paid, comment, sort_order) VALUES
('Maldiciones y Mitos', 'Rick Riordan (compilador) y varios autores', 'Montena', 'Fantasía juvenil / antología de mitologías del mundo', 'tengo', 'biblioteca/riordan-maldiciones-mitos.webp', 199.00, 'Etiqueta de rebaja: "Ya cambié de $399 a $199".', 354);

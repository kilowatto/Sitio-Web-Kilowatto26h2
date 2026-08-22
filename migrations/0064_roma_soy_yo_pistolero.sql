-- Dos libros nuevos. Esteban dijo inicialmente que las fotos (apaisadas) iban tal cual, pero
-- igual que con Animales Fantásticos, una vez vistas en la tabla real dijo que en realidad
-- salían rotadas y pidió rotarlas 90° a la derecha -- cover_r2_key ya refleja esa versión final
-- ("-v2"), key nueva por la misma caché edge de 1 año de /media/[...key].ts.
INSERT INTO books (title, author, publisher, release_year, genre, summary, cover_r2_key, price_paid, sort_order) VALUES
('Roma soy yo: La verdadera historia de Julio César', 'Santiago Posteguillo', 'Best Seller (Debolsillo)', NULL, 'Novela histórica',
 'La verdadera historia de Julio César: cómo un hombre reescribió las reglas de Roma y cambió el curso de la historia.',
 'biblioteca/roma-soy-yo-v2.webp', 599.00, 340);

INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, summary, cover_r2_key, sort_order) VALUES
('El Pistolero', 'Stephen King', 'Debolsillo', NULL, 'Fantasía oscura / western', 'La Torre Oscura', 1,
 'El primer libro de La Torre Oscura: Roland Deschain, el último pistolero, persigue al Hombre de Negro a través de un desierto que fue alguna vez un mundo como el nuestro.',
 'biblioteca/el-pistolero-v2.webp', 341);

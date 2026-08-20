-- Narnia (4 owned, photographed, $300 MXN each confirmed by Esteban) — chronological
-- (in-Narnia-timeline) reading order, the modern standard printed on current editions.
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, cover_r2_key, price_paid, sort_order) VALUES
('Las Crónicas de Narnia: El León, la Bruja y el Ropero', 'C. S. Lewis', 'HarperCollins Christian Publishing', '1950', 'Fantasía / clásico infantil', 'Las Crónicas de Narnia', 2, 'tengo', 'biblioteca/narnia-leon-bruja-ropero.webp', 300.00, 300),
('Las Crónicas de Narnia: El Caballo y su Muchacho', 'C. S. Lewis', 'HarperCollins Christian Publishing', '1954', 'Fantasía / clásico infantil', 'Las Crónicas de Narnia', 3, 'tengo', 'biblioteca/narnia-caballo-muchacho.webp', 300.00, 301),
('Las Crónicas de Narnia: El Príncipe Caspian', 'C. S. Lewis', 'HarperCollins Christian Publishing', '1951', 'Fantasía / clásico infantil', 'Las Crónicas de Narnia', 4, 'tengo', 'biblioteca/narnia-principe-caspian.webp', 300.00, 302),
('Las Crónicas de Narnia: La Silla de Plata', 'C. S. Lewis', 'HarperCollins Christian Publishing', '1953', 'Fantasía / clásico infantil', 'Las Crónicas de Narnia', 6, 'tengo', 'biblioteca/narnia-silla-plata.webp', 300.00, 303);

-- Harry Potter — caja completa "Letras de Bolsillo" (7, en orden — solo 2 tienen foto de
-- portada individual limpia; los otros 5 se ven en la caja pero no se fotografiaron sueltos,
-- así que cover_r2_key queda NULL en vez de adivinar, mismo criterio que Riordanverse).
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, price_paid, sort_order) VALUES
('Harry Potter y la Piedra Filosofal', 'J. K. Rowling', 'Salamandra (Letras de Bolsillo)', '1997', 'Fantasía juvenil', 'Harry Potter — Letras de Bolsillo (caja completa)', 1, 'tengo', NULL, 310),
('Harry Potter y la Cámara Secreta', 'J. K. Rowling', 'Salamandra (Letras de Bolsillo)', '1998', 'Fantasía juvenil', 'Harry Potter — Letras de Bolsillo (caja completa)', 2, 'tengo', NULL, 311);
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, cover_r2_key, price_paid, sort_order) VALUES
('Harry Potter y el Prisionero de Azkaban', 'J. K. Rowling', 'Salamandra (Letras de Bolsillo)', '1999', 'Fantasía juvenil', 'Harry Potter — Letras de Bolsillo (caja completa)', 3, 'tengo', 'biblioteca/hp-lb-azkaban.webp', NULL, 312),
('Harry Potter y el Cáliz de Fuego', 'J. K. Rowling', 'Salamandra (Letras de Bolsillo)', '2000', 'Fantasía juvenil', 'Harry Potter — Letras de Bolsillo (caja completa)', 4, 'tengo', 'biblioteca/hp-lb-caliz-fuego.webp', NULL, 313);
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, price_paid, sort_order) VALUES
('Harry Potter y la Orden del Fénix', 'J. K. Rowling', 'Salamandra (Letras de Bolsillo)', '2003', 'Fantasía juvenil', 'Harry Potter — Letras de Bolsillo (caja completa)', 5, 'tengo', NULL, 314),
('Harry Potter y el Misterio del Príncipe', 'J. K. Rowling', 'Salamandra (Letras de Bolsillo)', '2005', 'Fantasía juvenil', 'Harry Potter — Letras de Bolsillo (caja completa)', 6, 'tengo', NULL, 315),
('Harry Potter y las Reliquias de la Muerte', 'J. K. Rowling', 'Salamandra (Letras de Bolsillo)', '2007', 'Fantasía juvenil', 'Harry Potter — Letras de Bolsillo (caja completa)', 7, 'tengo', NULL, 316);

-- Harry Potter — edición Salamandra estándar (7, todas fotografiadas)
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, cover_r2_key, price_paid, sort_order) VALUES
('Harry Potter y la Piedra Filosofal', 'J. K. Rowling', 'Salamandra', '1997', 'Fantasía juvenil', 'Harry Potter — edición Salamandra', 1, 'tengo', 'biblioteca/hp-sal-piedra-filosofal.webp', NULL, 320),
('Harry Potter y la Cámara Secreta', 'J. K. Rowling', 'Salamandra', '1998', 'Fantasía juvenil', 'Harry Potter — edición Salamandra', 2, 'tengo', 'biblioteca/hp-sal-camara-secreta.webp', NULL, 321),
('Harry Potter y el Prisionero de Azkaban', 'J. K. Rowling', 'Salamandra', '1999', 'Fantasía juvenil', 'Harry Potter — edición Salamandra', 3, 'tengo', 'biblioteca/hp-sal-azkaban.webp', NULL, 322),
('Harry Potter y el Cáliz de Fuego', 'J. K. Rowling', 'Salamandra', '2000', 'Fantasía juvenil', 'Harry Potter — edición Salamandra', 4, 'tengo', 'biblioteca/hp-sal-caliz-fuego.webp', NULL, 323),
('Harry Potter y la Orden del Fénix', 'J. K. Rowling', 'Salamandra', '2003', 'Fantasía juvenil', 'Harry Potter — edición Salamandra', 5, 'tengo', 'biblioteca/hp-sal-orden-fenix-realista.webp', NULL, 324),
('Harry Potter y el Misterio del Príncipe', 'J. K. Rowling', 'Salamandra', '2005', 'Fantasía juvenil', 'Harry Potter — edición Salamandra', 6, 'tengo', 'biblioteca/hp-sal-misterio-principe.webp', NULL, 325),
('Harry Potter y las Reliquias de la Muerte', 'J. K. Rowling', 'Salamandra', '2007', 'Fantasía juvenil', 'Harry Potter — edición Salamandra', 7, 'tengo', 'biblioteca/hp-sal-reliquias-muerte.webp', NULL, 326);

-- Segunda copia física de "Orden del Fénix" — misma casa (Salamandra) pero portada
-- ilustrada distinta a la estándar; Esteban confirmó que son dos copias reales, no un
-- duplicado accidental de fotos.
INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, status, cover_r2_key, price_paid, comment, sort_order) VALUES
('Harry Potter y la Orden del Fénix (portada ilustrada)', 'J. K. Rowling', 'Salamandra', '2003', 'Fantasía juvenil', 'Harry Potter — edición Salamandra ilustrada', 5, 'tengo', 'biblioteca/hp-sal-orden-fenix-ilustrada.webp', NULL, 'Segunda copia física de este título — misma editorial, portada ilustrada distinta a la edición estándar.', 327);

-- Objeto de actividades basado en las películas, no una novela de la saga — sin reading_order.
INSERT INTO books (title, author, publisher, genre, series, status, cover_r2_key, comment, sort_order) VALUES
('Harry Potter: Destroza el Horrocrux', 'Wizarding World', 'Salamandra', 'Actividades interactivas (basado en las películas)', 'Harry Potter — objetos de colección', 'tengo', 'biblioteca/hp-destroza-horrocrux.webp', 'Libro interactivo de "rompe y destruye" basado en las películas de Harry Potter, no una novela de la saga principal.', 330);

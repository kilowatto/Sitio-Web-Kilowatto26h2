-- Dos libros nuevos, portadas fotografiadas en apaisado a propósito (Esteban lo confirmó
-- explícitamente esta vez: "no los rotes, los voy a mandar como deben ir") -- se guardan tal
-- cual, sin ninguna corrección de orientación.
INSERT INTO books (title, author, publisher, release_year, genre, summary, cover_r2_key, price_paid, sort_order) VALUES
('Roma soy yo: La verdadera historia de Julio César', 'Santiago Posteguillo', 'Best Seller (Debolsillo)', NULL, 'Novela histórica',
 'La verdadera historia de Julio César: cómo un hombre reescribió las reglas de Roma y cambió el curso de la historia.',
 'biblioteca/roma-soy-yo.webp', 599.00, 340);

INSERT INTO books (title, author, publisher, release_year, genre, series, reading_order, summary, cover_r2_key, sort_order) VALUES
('El Pistolero', 'Stephen King', 'Debolsillo', NULL, 'Fantasía oscura / western', 'La Torre Oscura', 1,
 'El primer libro de La Torre Oscura: Roland Deschain, el último pistolero, persigue al Hombre de Negro a través de un desierto que fue alguna vez un mundo como el nuestro.',
 'biblioteca/el-pistolero.webp', 341);

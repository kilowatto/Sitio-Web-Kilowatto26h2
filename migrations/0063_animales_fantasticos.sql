-- "Animales Fantásticos y Dónde Encontrarlos" (Newt Scamander / J. K. Rowling) -- el libro de
-- texto ficticio de Hogwarts, edición facsímil con diseño apaisado tipo diario de campo
-- (confirmado por Esteban: la portada en verdad va así, no es una foto mal rotada).
-- Precio real en la etiqueta: US $14.95 (ISBN 9786073827249) -- convertido a pesos mexicanos
-- al tipo de cambio del 22 de agosto de 2026 (~16.92 MXN/USD), no es un precio nativo en pesos.
--
-- cover_r2_key usa el sufijo "-v2": la primera subida (sin sufijo) se veía bien en R2
-- directo, pero el transform de Cloudflare Images en /media/[...key].ts la rotaba a vertical
-- al servir ?w= -- algún metadato de orientación sobrevivió el primer pipeline ffmpeg/PNG. La
-- v2 se generó con `cwebp -metadata none` directo del JPG original (sin paso intermedio por
-- ffmpeg/PNG) y se subió con una key nueva para evitar la caché edge de 1 año (immutable) de
-- la key vieja -- mismo fix ya usado antes en el sitio para este tipo de problema.
INSERT INTO books (title, author, publisher, genre, series, status, cover_r2_key, price_paid, comment, sort_order) VALUES
('Animales Fantásticos y Dónde Encontrarlos', 'J. K. Rowling (como Newt Scamander)', 'Penguin Random House Grupo Editorial',
 'Fantasía juvenil / libro de texto ficticio', 'Harry Potter — libros de texto de Hogwarts', 'tengo', 'biblioteca/animales-fantasticos-v2.webp',
 252.95, 'Precio en la etiqueta: US $14.95 (ISBN 9786073827249), convertido a pesos al tipo de cambio del 22 de agosto de 2026 (~16.92 MXN/USD).', 331);

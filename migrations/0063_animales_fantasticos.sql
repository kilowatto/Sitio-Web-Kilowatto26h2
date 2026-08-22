-- "Animales Fantásticos y Dónde Encontrarlos" (Newt Scamander / J. K. Rowling) -- el libro de
-- texto ficticio de Hogwarts, edición facsímil.
-- Precio real en la etiqueta: US $14.95 (ISBN 9786073827249) -- convertido a pesos mexicanos
-- al tipo de cambio del 22 de agosto de 2026 (~16.92 MXN/USD), no es un precio nativo en pesos.
--
-- cover_r2_key terminó en "-v3" tras tres intentos: la foto original tenía el libro fotografiado
-- en apaisado sobre la mesa; Esteban confirmó primero que ASÍ iba (no rotar), luego -- al verla
-- chica en la tabla junto a las demás portadas, todas en vertical -- pidió rotarla 90° a la
-- derecha, que es lo que realmente se necesitaba. La "-v2" (intento de enderezar el mismo
-- apaisado en vez de rotar 90°) quedó descartada. Cada subida usó una key nueva para evitar la
-- caché edge de 1 año (immutable) de /media/[...key].ts en la key anterior -- mismo fix ya usado
-- antes en el sitio para este tipo de problema.
INSERT INTO books (title, author, publisher, genre, series, status, cover_r2_key, price_paid, comment, sort_order) VALUES
('Animales Fantásticos y Dónde Encontrarlos', 'J. K. Rowling (como Newt Scamander)', 'Penguin Random House Grupo Editorial',
 'Fantasía juvenil / libro de texto ficticio', 'Harry Potter — libros de texto de Hogwarts', 'tengo', 'biblioteca/animales-fantasticos-v3.webp',
 252.95, 'Precio en la etiqueta: US $14.95 (ISBN 9786073827249), convertido a pesos al tipo de cambio del 22 de agosto de 2026 (~16.92 MXN/USD).', 331);

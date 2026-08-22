-- Precios de etiquetas Gandhi para libros del Riordanverse ya catalogados, más un libro
-- nuevo (Magos y Semidioses, sin foto de portada todavía -- solo llegó la etiqueta de precio).
UPDATE books SET price_paid = 219.00 WHERE id = 74; -- Los Nueve Mundos
UPDATE books SET price_paid = 149.00 WHERE id = 73; -- Héroes Nórdicos
UPDATE books SET price_paid = 289.00 WHERE id = 23; -- Las Crónicas de Kane 1: La Pirámide Roja
-- El Laberinto en Llamas: etiqueta muestra $389 tachado y $350 encima -- se toma el precio
-- final. Confirmar con Esteban si la lectura no es exacta (etiqueta parcialmente ilegible).
UPDATE books SET price_paid = 350.00 WHERE id = 33; -- Las Pruebas de Apolo 3: El Laberinto en Llamas
-- Etiqueta parcialmente desgastada/rayada -- lectura tentativa. Confirmar con Esteban.
UPDATE books SET price_paid = 300.00 WHERE id = 30; -- Magnus Chase 3: El Barco de los Muertos

-- Nuevo: "Magos y Semidioses" (crossover Percy Jackson x Crónicas de Kane) -- solo llegó la
-- etiqueta de precio, sin foto de portada. cover_r2_key queda NULL hasta que Esteban la mande.
INSERT INTO books (title, author, genre, status, price_paid, sort_order) VALUES
('Magos y Semidioses', 'Rick Riordan', 'Fantasía juvenil / mitología (crossover griego-egipcio)', 'tengo', 299.00, 356);

INSERT INTO book_quotes (book_id, quote_text, source, attributed_to, sort_order)
SELECT id, 'Bueno es el enemigo de excelente.', 'libro', 'Good to Great — Jim Collins', 3
FROM books WHERE title = 'Good to Great';

INSERT INTO book_quotes (book_id, quote_text, source, attributed_to, sort_order)
SELECT id, 'Enamórate del problema, no de tu primera solución.', 'libro', 'Enamórate del Problema, No de la Solución — Uri Levine', 4
FROM books WHERE title = 'Enamórate del Problema, No de la Solución';

INSERT INTO book_quotes (book_id, quote_text, source, attributed_to, sort_order)
SELECT id, 'Cuando las arañas tejen juntas, pueden atar a un león.', 'libro', 'Proverbio etíope, citado en Cuando las Arañas Tejen Juntas Pueden Atar a un León — Daniel Coyle', 5
FROM books WHERE title = 'Cuando las Arañas Tejen Juntas Pueden Atar a un León';

INSERT INTO book_quotes (book_id, quote_text, source, attributed_to, sort_order)
SELECT id, 'Mira, yo no quería ser mestizo.', 'libro', 'Percy Jackson y el Ladrón del Rayo — Rick Riordan', 1
FROM books WHERE title LIKE '%El Ladrón del Rayo%';

INSERT INTO book_quotes (book_id, quote_text, source, attributed_to, sort_order)
SELECT id, '¿Me contradigo? Sí, me contradigo. Soy inmenso, contengo multitudes.', 'libro', 'Walt Whitman, citado en La vida de Chuck — Stephen King', 2
FROM books WHERE title = 'La vida de Chuck';

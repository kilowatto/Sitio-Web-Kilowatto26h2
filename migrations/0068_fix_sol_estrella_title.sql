-- "El Sol y la Estrella: Una Aventura de Nico di Angelo" (id 37, wishlist desde
-- 0029_riordanverse.sql) y "La Profecía del Rayo y las Estrellas" (id 77, agregado en
-- 0067) son el MISMO libro -- el título original en la lista de deseos era una traducción
-- aproximada hecha antes de que se confirmara el título real de la edición en español.
-- Esteban lo confirmó directamente. Se fusiona en la fila original (conserva su
-- reading_order=26 dentro de la secuencia) y se borra la fila duplicada.
UPDATE books SET
  title = 'La Profecía del Rayo y las Estrellas',
  cover_r2_key = 'biblioteca/riordan-profecia-rayo.webp',
  status = 'tengo'
WHERE id = 37;

DELETE FROM books WHERE id = 77;

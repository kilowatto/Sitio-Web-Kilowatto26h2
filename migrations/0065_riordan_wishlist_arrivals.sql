-- 5 libros del Riordanverse que pasan de la lista de deseos a propiedad -- UPDATE de las filas
-- ya existentes (creadas en 0029_riordanverse.sql como 'quiero'), no INSERTs nuevos, para no
-- duplicar filas. Fotos rotadas 90° derecha, mismo pipeline limpio (cwebp directo del jpg, sin
-- ffmpeg/PNG) ya establecido para evitar el bug de auto-rotación de Cloudflare Images.
UPDATE books SET status = 'tengo', cover_r2_key = 'biblioteca/riordan-kane1.webp'
  WHERE id = 23; -- Las Crónicas de Kane 1: La Pirámide Roja

UPDATE books SET status = 'tengo', cover_r2_key = 'biblioteca/riordan-kane3.webp'
  WHERE id = 25; -- Las Crónicas de Kane 3: La Sombra de la Serpiente

UPDATE books SET status = 'tengo', cover_r2_key = 'biblioteca/riordan-magnus3.webp'
  WHERE id = 30; -- Magnus Chase y los Dioses de Asgard 3: El Barco de los Muertos

UPDATE books SET status = 'tengo', cover_r2_key = 'biblioteca/riordan-apolo2.webp', price_current = NULL, price_checked_at = NULL
  WHERE id = 32; -- Las Pruebas de Apolo 2: La Profecía Oscura

-- Esteban indicó que esta es una copia repetida (ya tenía otra) -- nota en `comment` en vez de
-- una segunda fila, para no duplicar el título en el catálogo.
UPDATE books SET status = 'tengo', cover_r2_key = 'biblioteca/riordan-apolo3.webp',
  comment = 'Esteban indicó que esta es una copia repetida (ya tenía otra).'
  WHERE id = 33; -- Las Pruebas de Apolo 3: El Laberinto en Llamas

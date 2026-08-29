-- Investigacion de precio/paginas/palabras para los 9 libros del batch anterior (ids 82-90),
-- via 3 agentes en paralelo (Amazon.com.mx, Mercado Libre, Gandhi, Planeta, El Sotano, Pendulo,
-- y tiendas internacionales convertidas a MXN al tipo de cambio del 29 ago 2026, 16.96 MXN/USD).
-- Precio de id 85 (Greek Mythology and Religion) NO se aplica -- confianza baja, viene de un
-- agregador europeo en EUR, no de una tienda en vivo -- se deja para que Esteban lo revise.
UPDATE books SET price_current = 49.00, price_checked_at = '2026-08-29' WHERE id = 82;
UPDATE books SET price_current = 368.00, price_checked_at = '2026-08-29' WHERE id = 83;
UPDATE books SET price_current = 332.10, price_checked_at = '2026-08-29' WHERE id = 84;
UPDATE books SET price_current = 368.00, price_checked_at = '2026-08-29', release_year = '2026' WHERE id = 86;
UPDATE books SET price_current = 279.00, price_checked_at = '2026-08-29' WHERE id = 87;
UPDATE books SET price_current = 458.00, price_checked_at = '2026-08-29' WHERE id = 88;
UPDATE books SET price_current = 499.00, price_checked_at = '2026-08-29' WHERE id = 89;
UPDATE books SET price_current = 349.00, price_checked_at = '2026-08-29' WHERE id = 90;

-- Correcciones de autor: la portada fotografiada no acreditaba un autor individual, pero la
-- investigacion de precio encontro el nombre real en el ISBN/ficha de la edicion.
UPDATE books SET author = 'Michael Kogge' WHERE id = 82;
UPDATE books SET author = 'Maria Mavromataki' WHERE id = 85;

-- Comentarios con paginas reales encontradas (el catalogo no tiene columna de paginas; se anota
-- aqui como referencia, y donde no hay conteo real de palabras se usa para estimar por genero).
UPDATE books SET comment = 'Parte de la colección "Star Wars Rebels" de Disney/Planeta Junior. 176 páginas. Precio: $49.00 MXN (El Sótano, confianza media -- agotado en Amazon.com.mx y Mercado Libre).' WHERE id = 82;
UPDATE books SET comment = '432 páginas. Precio confirmado en PlanetadeLibros México.' WHERE id = 83;
UPDATE books SET comment = 'Ilustraciones de Ben Mantle, traducción de Gemma Rovira Ortega. 304 páginas. No es parte del universo de Harry Potter -- historia independiente.' WHERE id = 84;
UPDATE books SET comment = '224 páginas. Precio SIN confirmar en tienda real -- viene de un agregador europeo (EUR convertido a MXN), no se encontró en ninguna tienda mexicana ni en el sitio del editor (bloqueado). Revisar con Esteban antes de dar por bueno.' WHERE id = 85;
UPDATE books SET comment = '344 páginas. Precio confirmado en Cafebrería El Péndulo.' WHERE id = 86;
UPDATE books SET comment = 'Edición 2 en 1 de Gandhi Ediciones: reúne "El mundo como yo lo veo" (1934) y "La teoría de la relatividad" (1916). Precio de Gandhi (rebajado de $405 a $279 MXN). No se encontró el conteo de páginas de esta edición conjunta.' WHERE id = 87;
UPDATE books SET comment = 'Título original: Radical Candor. 488 páginas. Precio confirmado en PlanetadeLibros México y Gandhi.' WHERE id = 88;
UPDATE books SET comment = 'Título original: Die unendliche Geschichte. 496 páginas (edición Loqueleo/Alfaguara 2022). Precio confirmado en Gandhi.' WHERE id = 89;
UPDATE books SET comment = 'Título original: The Psychology of Money. 312 páginas. Precio confirmado en PlanetadeLibros México y Gandhi (edición rústica con solapas).' WHERE id = 90;

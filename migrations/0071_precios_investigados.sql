-- Investigacion de precios de mercado via 7 agentes en paralelo (Amazon.com.mx, Mercado Libre,
-- Gandhi, El Sotano, Casa del Libro, Sanborns, Buscalibre, y tiendas de EUA convertidas a MXN
-- al tipo de cambio del 22 ago 2026, 16.95 MXN/USD). Va como price_current (estimado), NUNCA
-- como price_paid -- no sabemos lo que Esteban realmente pago sin foto de etiqueta.
-- Esteban confirmo aplicar todo excepto los 2 de confianza baja (id 7 y 37, que se dejan sin tocar).
UPDATE books SET price_current = 408.50, price_checked_at = '2026-08-22' WHERE id = 2;
UPDATE books SET price_current = 99.00, price_checked_at = '2026-08-22' WHERE id = 3;
UPDATE books SET price_current = 500.00, price_checked_at = '2026-08-22' WHERE id = 5;
UPDATE books SET price_current = 399.00, price_checked_at = '2026-08-22' WHERE id = 8;
UPDATE books SET price_current = 2520.00, price_checked_at = '2026-08-22' WHERE id = 9;
UPDATE books SET price_current = 1779.75, price_checked_at = '2026-08-22' WHERE id = 10;
UPDATE books SET price_current = 1779.75, price_checked_at = '2026-08-22' WHERE id = 11;
UPDATE books SET price_current = 379.00, price_checked_at = '2026-08-22' WHERE id = 12;
UPDATE books SET price_current = 399.00, price_checked_at = '2026-08-22' WHERE id = 13;
UPDATE books SET price_current = 389.00, price_checked_at = '2026-08-22' WHERE id = 14;
UPDATE books SET price_current = 399.00, price_checked_at = '2026-08-22' WHERE id = 15;
UPDATE books SET price_current = 399.00, price_checked_at = '2026-08-22' WHERE id = 16;
UPDATE books SET price_current = 299.00, price_checked_at = '2026-08-22' WHERE id = 17;
UPDATE books SET price_current = 419.00, price_checked_at = '2026-08-22' WHERE id = 18;
UPDATE books SET price_current = 419.00, price_checked_at = '2026-08-22' WHERE id = 19;
UPDATE books SET price_current = 249.00, price_checked_at = '2026-08-22' WHERE id = 20;
UPDATE books SET price_current = 249.00, price_checked_at = '2026-08-22' WHERE id = 21;
UPDATE books SET price_current = 249.00, price_checked_at = '2026-08-22' WHERE id = 22;
UPDATE books SET price_current = 179.00, price_checked_at = '2026-08-22' WHERE id = 24;
UPDATE books SET price_current = 279.00, price_checked_at = '2026-08-22' WHERE id = 25;
UPDATE books SET price_current = 279.00, price_checked_at = '2026-08-22' WHERE id = 26;
UPDATE books SET price_current = 399.00, price_checked_at = '2026-08-22' WHERE id = 27;
UPDATE books SET price_current = 389.00, price_checked_at = '2026-08-22' WHERE id = 28;
UPDATE books SET price_current = 524.83, price_checked_at = '2026-08-22' WHERE id = 29;
UPDATE books SET price_current = 421.43, price_checked_at = '2026-08-22' WHERE id = 31;
UPDATE books SET price_current = 369.00, price_checked_at = '2026-08-22' WHERE id = 32;
UPDATE books SET price_current = 287.20, price_checked_at = '2026-08-22' WHERE id = 34;
UPDATE books SET price_current = 249.00, price_checked_at = '2026-08-22' WHERE id = 35;
UPDATE books SET price_current = 350.00, price_checked_at = '2026-08-22' WHERE id = 36;
UPDATE books SET price_current = 249.00, price_checked_at = '2026-08-22' WHERE id = 38;
UPDATE books SET price_current = 455.30, price_checked_at = '2026-08-22' WHERE id = 39;
UPDATE books SET price_current = 139.00, price_checked_at = '2026-08-22' WHERE id = 40;
UPDATE books SET price_current = 395.00, price_checked_at = '2026-08-22' WHERE id = 41;
UPDATE books SET price_current = 406.44, price_checked_at = '2026-08-22' WHERE id = 43;
UPDATE books SET price_current = 189.00, price_checked_at = '2026-08-22' WHERE id = 44;
UPDATE books SET price_current = 249.00, price_checked_at = '2026-08-22' WHERE id = 45;
UPDATE books SET price_current = 121.00, price_checked_at = '2026-08-22' WHERE id = 46;
UPDATE books SET price_current = 329.91, price_checked_at = '2026-08-22' WHERE id = 47;
UPDATE books SET price_current = 349.00, price_checked_at = '2026-08-22' WHERE id = 52;
UPDATE books SET price_current = 429.00, price_checked_at = '2026-08-22' WHERE id = 53;
UPDATE books SET price_current = 417.03, price_checked_at = '2026-08-22' WHERE id = 54;
UPDATE books SET price_current = 539.00, price_checked_at = '2026-08-22' WHERE id = 55;
UPDATE books SET price_current = 469.00, price_checked_at = '2026-08-22' WHERE id = 56;
UPDATE books SET price_current = 511.53, price_checked_at = '2026-08-22' WHERE id = 57;
UPDATE books SET price_current = 475.90, price_checked_at = '2026-08-22' WHERE id = 58;
UPDATE books SET price_current = 299.00, price_checked_at = '2026-08-22' WHERE id = 59;
UPDATE books SET price_current = 299.00, price_checked_at = '2026-08-22' WHERE id = 60;
UPDATE books SET price_current = 349.00, price_checked_at = '2026-08-22' WHERE id = 61;
UPDATE books SET price_current = 429.00, price_checked_at = '2026-08-22' WHERE id = 62;
UPDATE books SET price_current = 449.00, price_checked_at = '2026-08-22' WHERE id = 63;
UPDATE books SET price_current = 499.00, price_checked_at = '2026-08-22' WHERE id = 64;
UPDATE books SET price_current = 429.00, price_checked_at = '2026-08-22' WHERE id = 65;
UPDATE books SET price_current = 529.00, price_checked_at = '2026-08-22' WHERE id = 66;
UPDATE books SET price_current = 279.00, price_checked_at = '2026-08-22' WHERE id = 67;
UPDATE books SET price_current = 474.43, price_checked_at = '2026-08-22' WHERE id = 68;
UPDATE books SET price_current = 199.00, price_checked_at = '2026-08-22' WHERE id = 71;
UPDATE books SET price_current = 461.14, price_checked_at = '2026-08-22' WHERE id = 72;
UPDATE books SET price_current = 435.93, price_checked_at = '2026-08-22' WHERE id = 75;

-- Sin precio encontrado en ninguna tienda (descatalogados) -- se limpia el estimado generico viejo
-- de 2026-07-26 en vez de dejar un numero inventado.
UPDATE books SET price_current = NULL, price_checked_at = NULL WHERE id = 1;

-- Datos adicionales (editorial/ano) encontrados de paso durante la investigacion de precios.
UPDATE books SET publisher = 'Montena', release_year = '2018' WHERE id = 17; -- corrige: catalogado como Salamandra, es Montena
UPDATE books SET publisher = 'Montena', release_year = '2019' WHERE id = 72;
UPDATE books SET publisher = 'Editorial Limusa', release_year = '2010', comment = 'Titulo completo: "Kakaw. Evolucion y revolucion", Coleccion Xocoyo (Fundacion Grupo Mexico), por Jose Ramon Castillo.' WHERE id = 5;
UPDATE books SET release_year = '2023' WHERE id = 9;
UPDATE books SET release_year = '2022' WHERE id = 10;
UPDATE books SET release_year = '2023' WHERE id = 11;
UPDATE books SET publisher = 'LID Editorial', release_year = '2024' WHERE id = 40;
UPDATE books SET publisher = 'Deusto' WHERE id = 41;
UPDATE books SET release_year = '2020' WHERE id = 44;
UPDATE books SET publisher = 'Disney Lucasfilm Press', release_year = '2018' WHERE id = 46;
UPDATE books SET publisher = 'Autopublicado (midudev)', release_year = '2024' WHERE id = 47;
UPDATE books SET release_year = '2017' WHERE id = 71;
UPDATE books SET release_year = '2022' WHERE id = 67;
UPDATE books SET release_year = '2022' WHERE id = 35;

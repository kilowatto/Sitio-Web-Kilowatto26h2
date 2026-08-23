-- Esteban confirmo el precio real que pago por este libro (Mercado Libre) -- va como price_paid,
-- no como estimado, y reemplaza el intento fallido de buscarlo (estaba descatalogado/sin listado).
UPDATE books SET price_paid = 499.00 WHERE id = 1;

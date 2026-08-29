-- Seis de las nueve gráficas de columna colgaban de la columna equivocada.
--
-- Artemis II -- una columna sobre la misión espacial -- mostraba una gráfica titulada "¿A quién
-- prefirieron los pacientes?" con el 79% del estudio UCSD/JAMA. Ese 79 no aparece ni una vez en
-- su texto; aparece en "El Dr. GPT le atenderá ahora". Lo mismo con otras cinco.
--
-- Viene de origen: los datos vivían clavados en un objeto BRIEFS dentro de
-- generate-images.ts, indexado por slug, y ese índice estaba mal. La migración 0079 los movió a
-- column_charts fielmente, errores incluidos. Nadie lo notó porque la infografía se rasterizaba
-- a PNG y un lector que no rehace la cuenta no distingue una gráfica ajena de una propia.
--
-- Se volvió urgente hoy: las columnas empezaron a dibujar su gráfica de verdad, con tabla
-- accesible debajo. Un PNG equivocado es un error; una tabla de datos equivocada es una cifra
-- que un motor de respuestas puede citar como tuya.
--
-- Verificado en las dos direcciones antes de mover: la cifra central de cada gráfica NO está en
-- el body_html de la columna que la mostraba, y SÍ está en el de la columna destino.
UPDATE column_charts SET column_id = 4  WHERE column_id = 3;   -- identidades → credencial-salud-boveda-nacional
UPDATE column_charts SET column_id = 7  WHERE column_id = 5;   -- pacientes/IA → dr-gpt-te-atendera-ahora
UPDATE column_charts SET column_id = 11 WHERE column_id = 9;   -- chips en China → ia-es-real-burbuja-nvidia-no
UPDATE column_charts SET column_id = 16 WHERE column_id = 15;  -- evitación de noticias → 80-horas-a-la-semana
UPDATE column_charts SET column_id = 14 WHERE column_id = 13;  -- cuota de nube → fragilidad-de-la-nube
DELETE FROM column_charts WHERE column_id = 2;                 -- copia idéntica de la anterior

-- Author bios for the three themed biblioteca sub-pages (Harry Potter, Riordanverse, Arrakis) --
-- Esteban asked for author history + curious facts on each page, and for Larry (the RAG chatbot)
-- to know this too. One shared table instead of writing the prose twice (once per page, once for
-- Larry) -- src/pages/api/reindex.ts pulls the same rows into the vector index.
CREATE TABLE authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bio_html TEXT NOT NULL,
  fun_facts_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO authors (slug, name, bio_html, fun_facts_json) VALUES (
  'jk-rowling',
  'J. K. Rowling',
  '<p>Joanne Rowling nació el 31 de julio de 1965 en Yate, Inglaterra. La idea de Harry Potter le llegó casi completa —el niño, la escuela de magia, buena parte de la trama— durante un retraso de cuatro horas en un tren de Manchester a Londres en 1990, sin siquiera un bolígrafo a la mano para anotarla.</p><p>Escribió gran parte de <em>La Piedra Filosofal</em> como madre soltera, con pocos recursos, en cafés de Edimburgo mientras su hija dormía en la carriola junto a la mesa. El manuscrito lo rechazaron doce editoriales antes de que Bloomsbury lo aceptara — según se cuenta, por insistencia de la hija de ocho años del editor, que leyó el primer capítulo y exigió el resto. Bloomsbury le pidió firmar con iniciales, "J. K." (la K es por Kathleen, el nombre de su abuela — Rowling no tiene segundo nombre), por temor a que los niños no quisieran leer a una autora.</p>',
  '["El cumpleaños de Harry, el 31 de julio, es el mismo día que el de Rowling.","El manuscrito de La Piedra Filosofal fue rechazado por 12 editoriales antes de que Bloomsbury lo aceptara.","Pasó de vivir de la asistencia social a convertirse en una de las autoras más vendidas de la historia.","También escribe novela policiaca para adultos bajo el seudónimo Robert Galbraith (la serie de Cormoran Strike).","Fundó Lumos, una organización dedicada a niños que viven en instituciones."]'
);

INSERT INTO authors (slug, name, bio_html, fun_facts_json) VALUES (
  'frank-herbert',
  'Frank Herbert',
  '<p>Frank Herbert nació el 8 de octubre de 1920 en Tacoma, Washington, y antes de dedicarse de tiempo completo a escribir trabajó como periodista, fotógrafo, buzo de ostras y hasta maestro de escritura creativa. La idea de <em>Dune</em> surgió mientras investigaba un reportaje sobre un programa del gobierno de EUA para fijar dunas de arena móviles en la costa de Oregon sembrando pastizales — el choque entre un ecosistema frágil, la intervención humana y el poder de controlar un recurso escaso se convirtió, con los años, en Arrakis y la especia.</p><p>Tardó varios años en investigar y escribir la novela, y el manuscrito fue rechazado por más de veinte editoriales antes de que Chilton Book Company —conocida hasta entonces por manuales de reparación de autos, no por ciencia ficción— decidiera publicarla en 1965. Ese mismo año ganó el primer Premio Nébula a la mejor novela, y al siguiente el Hugo: la primera vez que una misma novela se llevaba los dos premios más importantes de la ciencia ficción.</p>',
  '["Antes de Dune fue reportero, fotógrafo y buzo de ostras.","La idea de Arrakis nació investigando un programa real para fijar dunas móviles con pastizales en la costa de Oregon.","Chilton, la editorial que aceptó Dune, era conocida por manuales de autos, no por ciencia ficción.","Dune fue la primera novela en ganar el Nébula y el Hugo — los dos premios más importantes de ciencia ficción — el mismo año.","Herbert escribió cinco secuelas antes de morir en 1986; su hijo Brian continuó la saga junto con Kevin J. Anderson."]'
);

INSERT INTO authors (slug, name, bio_html, fun_facts_json) VALUES (
  'rick-riordan',
  'Rick Riordan',
  '<p>Rick Riordan nació en 1964 en San Antonio, Texas, y durante años fue maestro de inglés e historia en escuelas de Texas y San Francisco antes de dedicarse de tiempo completo a escribir. Percy Jackson nació como los cuentos que le contaba a su hijo Haley —diagnosticado con dislexia y déficit de atención— cuando el niño se quedó sin libros de mitología griega que leer en la escuela y le pidió a su papá, que enseñaba el tema, que inventara una historia nueva.</p><p>Por eso Percy también tiene dislexia y déficit de atención — a propósito, para que sean la razón por la que es un héroe (la dislexia, porque su cerebro está programado para leer griego antiguo; el déficit de atención, porque son reflejos de combate) y no un obstáculo. Riordan ya era novelista publicado —una serie de misterio para adultos que ganó un Edgar Award— antes de que Percy Jackson se volviera un fenómeno. Después creó el sello editorial "Rick Riordan Presents", dedicado a publicar novelas de mitología escritas por autores de las culturas de origen —azteca, coreana, filipina, de África occidental— para que más niños encontraran héroes de su propia mitología.</p>',
  '["Antes de Percy Jackson, Riordan ya había ganado un Edgar Award por su serie de misterio para adultos Tres Navarre.","Percy Jackson nació de cuentos improvisados para su hijo Haley.","El déficit de atención y la dislexia de Percy son un homenaje deliberado a su hijo, no un defecto del personaje.","Creó el sello \"Rick Riordan Presents\" para publicar mitologías de otras culturas contadas por autores de esas culturas.","El universo que reúne Percy Jackson, Magnus Chase y Las Crónicas de Kane fue una expansión deliberada: griego/romano, nórdico y egipcio, cada uno con su propio panteón real detrás."]'
);

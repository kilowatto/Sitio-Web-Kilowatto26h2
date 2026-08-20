-- Curated pull-quotes in Esteban's own words (from docs/100-preguntas-vida.md), used as
-- accents on existing pages (placement) and listed in full on a new "Curiosidades" page.
-- Deliberately about him only — no named relatives, no family composition (see
-- docs/reglas-editoriales-privacidad.md).
CREATE TABLE quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  category TEXT NOT NULL,
  placement TEXT,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX idx_quotes_placement ON quotes(placement);

INSERT INTO quotes (text, category, placement, sort_order) VALUES
  ('Así es la vida: te pegan, te caes, te levantas, te pones triste, avanzas, te vuelves a tropezar, casi te caes pero no, sigues caminando, corres.', 'filosofia', 'home', 1),
  ('Como todo es naranja, ahora tengo muchas playeras y tenis naranjas. No le pongo atención a la moda — me visto para no ir desnudo.', 'curiosidades', 'home', 2),
  ('Nunca me titulé del ITAM. Me aburrí, ya estaba trabajando muy bien. Debí estudiar Física desde el principio, pero así es la vida.', 'formacion', 'trayectoria', 1),
  ('Recomendé para un puesto directivo a alguien técnicamente bueno pero un verdadero idiota para todo lo demás. Debí tomarlo yo. EpicFail.', 'negocio', 'trayectoria', 2),
  ('People, Process, Product. Con eso mejoré muchísimo.', 'negocio', 'empresas', 1),
  ('El error más común de los líderes tech en Latinoamérica: copian modelos de Estados Unidos sin adaptarlos al contexto regional.', 'negocio', 'empresas', 2),
  ('Lo más difícil de vender la nube en 2014 no era convencer de que era segura — era regalarle el margen a Amazon cuando me lo podía quedar yo mismo.', 'negocio', 'inversiones', 1),
  ('Invierto en academias de fútbol en Estados Unidos. A mí el fútbol no me gusta nada.', 'curiosidades', 'inversiones', 2),
  ('¿Por qué Mérida? Si lo descubres, avísame.', 'curiosidades', 'yucatech', 1),
  ('El Yucatech Festival no es negocio, ni remotamente — me ha costado dinero. No sé si algún día lo voy a capitalizar, y no me importa.', 'filosofia', 'yucatech', 2),
  ('Tomo entre 4 y 10 tazas de café al día. ¿Tú cuántas? ¿Está mal? Así soy yo.', 'curiosidades', NULL, 1),
  ('No soy bueno dando consejos — se me convierten en una clase que no lleva a nada. No me pidas consejos.', 'curiosidades', NULL, 2),
  ('Si pudiera borrar las secuelas de Star Wars (episodios 7, 8 y 9) y tener más contenido de Ahsoka en su lugar, sería mejor.', 'curiosidades', NULL, 3),
  ('Puedo pasar meses sin verme al espejo. Con las videollamadas me he visto más seguido últimamente.', 'curiosidades', NULL, 4),
  ('Mi primer dinero lo gasté, lo desperdicié, viajé. No sé dónde está. Ups.', 'curiosidades', NULL, 5),
  ('Que me incluyan en "World''s Top 50 Leaders to follow" me da exactamente igual. Ni me va ni me viene — no es como que me paguen, jaja.', 'curiosidades', NULL, 6),
  ('Desconfío de las personas que no toman café, ¿tú no lo haces?', 'curiosidades', NULL, 7),
  ('¿Lo más "Kilowatto" que hice este año? No sé, te lo cuento cuando muera.', 'curiosidades', NULL, 8);

UPDATE timeline_events
SET description = 'Configuración de firewalls — su primera oportunidad llegó a través de sus contactos en los Scouts. A su papá no le gustó nada y lo tuvo que dejar por un tiempo: la única vez que la tecnología le costó un regaño en casa.'
WHERE title = 'Primer contrato laboral, a los 16 años';

UPDATE timeline_events
SET description = 'Gerente del área de sistemas, mientras cursaba el ITAM — carrera que nunca terminó de titular. Se aburrió porque ya estaba trabajando muy bien. Ahí también cometió lo que llama su error más caro: recomendar para un puesto directivo a alguien "técnicamente bueno pero un verdadero idiota para todo lo demás", cuando debió tomar el puesto él mismo. "EpicFail", resume hoy.'
WHERE title = 'Ingresa a la Universidad Latinoamericana';

UPDATE timeline_events
SET description = 'Nace del hartazgo de trabajar para alguien más. Consiguió su primer cliente por recomendación de un conocido — y perdió el primero que se le fue por un error propio, no por precio ni por competencia.'
WHERE title = 'Se independiza y funda DeSiCi';

UPDATE timeline_events
SET description = 'Pionera del cloud computing como servicio en México. El reto no era solo convencer a un empresario mexicano desconfiado de que "la nube" era segura — era convencerlo de usar un proveedor local en vez de irse directo con un hyperscaler como Amazon, regalándole el margen.'
WHERE title = 'Funda OnCloud';

-- "The Book" (Hungry Minds), comprado por Esteban en Amazon.com.mx (ASIN B0FQNZYZMD). Esteban
-- pidio una investigacion completa antes de publicar -- historia, datos curiosos y todo lo
-- relevante, para que Larry tambien lo sepa (el campo summary se indexa completo en reindex.ts).
--
-- Investigado via WebSearch/WebFetch: es una enciclopedia ilustrada de 410 paginas (algunas
-- fuentes dicen 405) creada por el colectivo "Hungry Minds" (fundado por Vsevolod "Seva"
-- Batichev y Timur Kadyrov, con Artur Stelmakh como socio de crowdfunding), nacida de una
-- campana de Kickstarter/Indiegogo en diciembre 2020 que recaudo mas de 3 millones de dolares --
-- uno de los proyectos editoriales mas financiados en la historia de Kickstarter. Precio oficial
-- en la tienda de Hungry Minds: $119.00 USD -> ~$2,016.05 MXN al tipo de cambio del 24 ago 2026
-- (16.95 MXN/USD) -- se deja como price_current (estimado), no price_paid, porque Amazon.com.mx
-- no muestra el precio a scraping automatizado; si Esteban confirma lo que realmente pago ahi
-- se corrige a price_paid como con Operacion Tucan.
INSERT INTO books (title, author, genre, publisher, release_year, status, cover_r2_key, price_current, price_checked_at, summary, comment, sort_order) VALUES (
  'The Book: La Guía Definitiva para Reconstruir la Civilización',
  'Hungry Minds (colectivo creativo)',
  'Divulgación / enciclopedia ilustrada',
  'Duomo Ediciones',
  '2025',
  'tengo',
  'biblioteca/the-book-hungry-minds.webp',
  2016.05,
  '2026-08-24',
  'Enciclopedia ilustrada de 410 páginas y más de 700 ilustraciones originales, organizada en 23 capítulos que van desde habilidades básicas de supervivencia (hacer fuego, purificar agua) hasta logros civilizatorios complejos (navegación, aviación, medicina, psicoterapia, música, organización social) — literalmente un manual para reconstruir la civilización desde cero. La estética retrofuturista, con ilustraciones que imitan grabados renacentistas, está inspirada en el enigmático Manuscrito Voynich (siglo XV) y organiza el conocimiento según un sistema de clasificación inspirado en la "Summa Technologiae" de Stanisław Lem.',
  'Nació de una campaña de Kickstarter/Indiegogo lanzada en diciembre de 2020 por el colectivo Hungry Minds (fundadores: Vsevolod "Seva" Batichev y Timur Kadyrov, con Artur Stelmakh como socio de crowdfunding) — recaudó más de 3 millones de dólares entre ambas plataformas, uno de los proyectos editoriales más financiados en la historia de Kickstarter. Edición en español publicada por Duomo Ediciones el 3 de noviembre de 2025. Precio de tienda oficial: $119.00 USD (~$2,016 MXN al tipo de cambio del 24 ago 2026) -- pendiente confirmar el precio real pagado en Amazon.com.mx. Pesa unos 2.3 kg.',
  420
);

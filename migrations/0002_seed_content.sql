-- Seed data (es-MX canonical) from docs/bio-esteban-rey-ortega.md, docs/bios-familia.md, docs/100-preguntas-vida.md

INSERT INTO profile (id, full_name, display_name, nickname, birth_date, birth_place, bio_short) VALUES (
  1,
  'Esteban Rey Ortega',
  'Esteban Rey',
  'Kilowatto',
  '1980-12',
  'Ciudad de México',
  'Arquitecto de sistemas, CEO e inversionista serial con más de 25 años en tecnología. Fundador de Ignia Cloud y del Yucatech Festival, y de Orange Rhino Investments. Conocido en la industria como "Kilowatto".'
);

INSERT INTO companies (slug, name, role, start_date, end_date, is_current, summary, website_url, sort_order) VALUES
  ('ula', 'Universidad Latinoamericana (ULA)', 'Gerente de Sistemas', '2000', '2003', 0, 'Primer empleo formal: despliegue de red física alámbrica e inalámbrica (tecnología muy nueva en su época), VoIP, ERP y CRM. Su abuelo Tito fue miembro fundador y ex-rector de esta misma universidad.', NULL, 1),
  ('prochemex', 'Prochemex', 'CTO / Project Manager', '2003', '2006', 0, 'Institución financiera mexicana de protección y respaldo de transacciones. Lideró la migración a Pivotal CRM ContactCenter sobre Microsoft .NET, mejorando el tiempo de respuesta del centro de contacto en más de 50% y logrando más de 10% de crecimiento mensual en tarjetahabientes.', NULL, 2),
  ('desici', 'DeSiCi (Desarrollo de Sistemas Corporativos en Internet)', 'Fundador', '2003', '2018', 0, 'Empresa de desarrollo a medida y consultoría de procesos. Partner autorizado de Zoho (CRM, Books). Operó más de 15 años como puente entre empresas latinoamericanas y software ágil de clase mundial.', 'https://desici.com', 3),
  ('oncloud', 'OnCloud (Súbete a la Nube S.A. de C.V.)', 'Fundador y CEO, luego CTO', '2014', NULL, 0, 'Pionera del cloud computing/IaaS en México. Modelo "Cero Inversión Inicial". Alianzas con Pure Storage, Rubrik y Acronis. Vendida con un retorno de 19x para los socios (104% anualizado).', NULL, 4),
  -- NOTA (2026-07-19): Esteban pidió expresamente quitar Octapus ("no tengo nada que ver con ellos", "eso es pasado").
  -- No sembrar Octapus como company. Ver docs/bio-esteban-rey-ortega.md para la nota de corrección.
  ('ignia-cloud', 'Ignia Cloud', 'Fundador y CEO', NULL, NULL, 1, '"La Nube Naranja" — nube soberana e hiperpotente para México y LatAm, con arquitecturas híbridas/multicloud. 99.9% SLA, hasta 12M IOPS, tráfico ilimitado sin cargos ocultos.', NULL, 6);

-- NOTA (2026-07-19): Esteban confirmó que NO es inversionista de Finsus — el informe de prensa original
-- lo daba por hecho (relación/cercanía con Carlos Marmolejo, CEO de Finsus, ponente en Yucatech) pero no es una inversión.
-- No sembrar Finsus como investment. La relación con Marmolejo/Yucatech sigue siendo válida como dato de evento, no de inversión.
INSERT INTO investments (slug, name, category, summary, website_url, sort_order) VALUES
  ('orange-rhino-investments', 'Orange Rhino Investments', 'holding', 'Vehículo de inversión con estrategia "mancuerna": tecnología financiera de alto crecimiento combinada con activos físicos generadores de flujo de caja.', NULL, 1),
  ('academias-futbol-eeuu', 'Academias de fútbol en EE. UU.', 'sports', 'Inversión en infraestructura de desarrollo de talento deportivo juvenil (modelo pay-to-play) en Estados Unidos.', NULL, 3),
  ('frida-cafe', 'Frida Café', 'fmcg', 'Café 100% orgánico de especialidad mexicano, modelo omnicanal con presencia física y comercio D2C.', NULL, 4);

INSERT INTO timeline_events (event_date, title, description, category, source_type) VALUES
  ('1985', 'Aprende BASIC en una Atari 65XE', 'Primer contacto serio con la programación, en la casa familiar del Ajusco.', 'personal', 'self'),
  ('1985', 'Nace el apodo "Kilowattito"', 'A los 5 años desarma la videocasetera de su abuelo Tito intentando entender cómo funciona.', 'personal', 'self'),
  ('1996', 'Primer contrato laboral, a los 16 años', 'Configuración de firewalls — su primera oportunidad llegó a través de sus contactos en los Scouts.', 'professional', 'self'),
  ('2000', 'Ingresa a la Universidad Latinoamericana', 'Gerente del área de sistemas.', 'company', 'self'),
  ('2003', 'Se independiza y funda DeSiCi', NULL, 'company', 'self'),
  ('2013-06-20', 'Se casa con Rocío', 'Ceremonia en el Lienzo Charro del Pedregal, 220 invitados.', 'personal', 'self'),
  ('2014', 'Funda OnCloud', 'Pionera del cloud computing como servicio en México.', 'company', 'self'),
  ('2022', 'Candidatura a LACNIC', 'Se postula a un órgano electivo de LACNIC (Registro de Direcciones de Internet para América Latina y Caribe). En los meses previos a la candidatura leyó 19 libros de Isaac Asimov y toda la obra biográfica de Walter Isaacson — su favorito sigue siendo el cuento "La Última Pregunta" de Asimov.', 'professional', 'press'),
  ('2026-04-16', 'Primer Yucatech Festival', 'Evento de innovación tecnológica en el Centro Internacional de Congresos de Yucatán, Mérida — más de 500 asistentes. Ponentes: Uri Levine (cofundador de Waze), Carlos Santana (experto en IA) y Jaime Restrepo (ciberseguridad). La "Elevator Pitch Hour" la ganó Creare Ride, startup con sede en Hidalgo. Confirmado como evento anual.', 'company', 'press'),
  ('2025', 'Reconocimiento: World''s Top 50 Leaders to follow', 'Incluido en la lista "World''s Top 50 Leaders to follow" (AllAroundWorlds) por su capacidad disruptiva en el panorama de cómputo en la nube al frente de Ignia Cloud.', 'recognition', 'press'),
  ('2025', 'Voz en el Senado de la República', 'Invitado frecuente a foros legislativos en el Senado de la República de México, donde aboga por la educación STEM, la ciberseguridad y ecosistemas digitales inclusivos.', 'recognition', 'press');

INSERT INTO family_members (slug, full_name, nickname, relationship, birth_date, birth_place, death_date, bio, is_public_figure, sort_order) VALUES
  ('tito', 'Luis Manuel Rey García', 'Tito', 'Abuelo paterno', '1922-12-20', 'Ciudad de México', '2005-08-16', 'Director de la Escuela/Facultad de Odontología de la UNAM (1973-1981). Bajo su gestión se crearon 14 especialidades de posgrado y la Escuela se elevó a Facultad de Odontología en 1975. Miembro fundador del Colegio Nacional de Cirujanos Dentistas, y miembro fundador y ex-rector de la ULA. Nombrado Profesor Emérito por el Consejo Universitario de la UNAM en 1989. En su honor existe la Presea "Dr. Manuel Rey García".', 1, 1),
  ('tita', 'María del Socorro Bosch López de Llergo', 'Tita', 'Abuela paterna', '1928-09-16', 'Ciudad del Carmen, Campeche', '2026-04-05', 'Esposa de Tito. Figura privada, sin registros públicos.', 0, 2),
  ('papa', 'Ricardo Rey Bosch', NULL, 'Padre', NULL, NULL, NULL, 'Cirujano dentista, como su padre Tito.', 0, 3),
  ('mama', 'María Mónica Ortega Kegel', NULL, 'Madre', NULL, NULL, NULL, NULL, 0, 4),
  ('abuelo-materno', 'José Luis Ortega Quintero', NULL, 'Abuelo materno', NULL, NULL, '1967', 'Esteban nunca lo conoció — falleció joven, cuando su mamá tenía apenas ~10 años. Tuvo un restaurante cerca del Ángel de la Independencia en la Ciudad de México, alrededor de 1960.', 0, 5),
  ('abue', 'María Pilar Kegel Ortiz', 'Abue', 'Abuela materna', '1933', NULL, NULL, NULL, 0, 6);

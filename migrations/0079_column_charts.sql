-- Column chart data, out of the source file and into the database.
--
-- Nine columns cite real, comparable numbers, and every one of them lived as a hardcoded object
-- inside src/pages/api/columns/[id]/generate-images.ts, keyed by slug. That was fine while the
-- only consumer was the infographic renderer. It stopped being fine the moment a clip wanted the
-- same numbers: a column had, structurally, no data at all, so clip-sweeper.ts excludes columns
-- outright and every column clip would have been a hook with nothing under it.
--
-- Same shape as investigacion_charts on purpose, down to data_json, so one reader
-- (clip-script.ts toBars) serves both without a branch.
CREATE TABLE column_charts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id INTEGER NOT NULL REFERENCES columns(id),
  chart_key TEXT NOT NULL,
  chart_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  data_json TEXT NOT NULL,
  source_note TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_column_charts_column ON column_charts(column_id, position);

INSERT INTO column_charts (column_id, chart_key, chart_type, title, description, data_json, position)
  SELECT id, 'principal', 'bar', '¿Qué tan caro es Fable?', 'Costo de su API comparado con otros modelos',
         '{"items":[{"label":"vs. GPT (gen. anterior)","values":[{"value":15,"displayValue":"15x"}]},{"label":"vs. Opus 4.8","values":[{"value":10,"displayValue":"10x"}]},{"label":"vs. Sonnet 5","values":[{"value":50,"displayValue":"50x"}]}]}', 0
    FROM columns WHERE slug = 'mis-aventuras-con-fable';

INSERT INTO column_charts (column_id, chart_key, chart_type, title, description, data_json, position)
  SELECT id, 'principal', 'bar', '¿Quién controla la nube?', 'Participación del mercado global de infraestructura en la nube',
         '{"items":[{"label":"Google Cloud","values":[{"value":13,"displayValue":"13%"}]},{"label":"Microsoft Azure","values":[{"value":20,"displayValue":"20%"}]},{"label":"Amazon AWS","values":[{"value":30,"displayValue":"30%"}]}]}', 0
    FROM columns WHERE slug = 'internet-too-big-to-fail';

INSERT INTO column_charts (column_id, chart_key, chart_type, title, description, data_json, position)
  SELECT id, 'principal', 'bar', 'Identidades que carga un mexicano', 'Documentos distintos hoy vs. la propuesta de una sola identidad digital',
         '{"items":[{"label":"Propuesta: una identidad digital","values":[{"value":1,"displayValue":"1"}]},{"label":"Hoy: INE, CURP, RFC, cédula, licencia...","values":[{"value":6,"displayValue":"6+"}]}]}', 0
    FROM columns WHERE slug = 'credenciales-fantasma';

INSERT INTO column_charts (column_id, chart_key, chart_type, title, description, data_json, position)
  SELECT id, 'principal', 'bar', '¿A quién prefirieron los pacientes?', 'Estudio UCSD/JAMA: respuestas de IA vs. médicos',
         '{"items":[{"label":"Médicos","values":[{"value":21,"displayValue":"21%"}]},{"label":"Respuesta de la IA","values":[{"value":79,"displayValue":"79%"}]}]}', 0
    FROM columns WHERE slug = 'artemis-ii';

INSERT INTO column_charts (column_id, chart_key, chart_type, title, description, data_json, position)
  SELECT id, 'principal', 'bar', 'Historial de padrones telefónicos en México', 'Intentos del Estado por crear un registro obligatorio de líneas móviles',
         '{"items":[{"label":"PANAUT (2021, declarado inconstitucional)","values":[{"value":1,"displayValue":"2021"}]},{"label":"RENAUT (2009, filtrado y cancelado)","values":[{"value":1,"displayValue":"2009"}]},{"label":"Nuevo registro (2026, vulnerado día 1)","values":[{"value":1,"displayValue":"2026"}]}]}', 0
    FROM columns WHERE slug = 'padron-del-desastre';

INSERT INTO column_charts (column_id, chart_key, chart_type, title, description, data_json, position)
  SELECT id, 'principal', 'bar', 'El mercado chino de chips de IA', 'Participación de NVIDIA en China, 2023 vs. 2025',
         '{"items":[{"label":"Hoy (2025)","values":[{"value":50,"displayValue":"~50%"}]},{"label":"Antes (2023)","values":[{"value":95,"displayValue":"95%"}]}]}', 0
    FROM columns WHERE slug = 'club-vip-hardware';

INSERT INTO column_charts (column_id, chart_key, chart_type, title, description, data_json, position)
  SELECT id, 'principal', 'bar', 'El costo del hardware en 2026', 'Incremento estimado de precio vs. 2024, por escasez de memoria',
         '{"items":[{"label":"Precio 2024 (base)","values":[{"value":100,"displayValue":"base"}]},{"label":"Precio estimado 2026","values":[{"value":128,"displayValue":"+20-30%"}]}]}', 0
    FROM columns WHERE slug = 'ia-se-comio-tu-memoria';

INSERT INTO column_charts (column_id, chart_key, chart_type, title, description, data_json, position)
  SELECT id, 'principal', 'bar', 'Quién sostiene la nube global', 'Participación combinada de los tres mayores proveedores',
         '{"items":[{"label":"Google Cloud","values":[{"value":13,"displayValue":"13%"}]},{"label":"Microsoft Azure","values":[{"value":20,"displayValue":"20%"}]},{"label":"Amazon AWS","values":[{"value":30,"displayValue":"30%"}]}]}', 0
    FROM columns WHERE slug = 'impuesto-silencioso-de-la-ia';

INSERT INTO column_charts (column_id, chart_key, chart_type, title, description, data_json, position)
  SELECT id, 'principal', 'bar', 'La adicción invisible a las noticias', 'Encuestas Pew Research / Reuters Institute',
         '{"items":[{"label":"Evitan activamente ciertas noticias","values":[{"value":38,"displayValue":"38%"}]},{"label":"Conectados constantemente a noticias","values":[{"value":30,"displayValue":"30%"}]}]}', 0
    FROM columns WHERE slug = 'frida-cafe';

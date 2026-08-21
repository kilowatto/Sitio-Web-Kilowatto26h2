# Investigaciones — spec en construcción

Nueva sección de contenido, hermana de "Columnas" pero de otra escala: piezas de
investigación profunda (varias semanas de trabajo, decenas de fuentes, metodología
documentada), no columnas de opinión cortas.

## Referencia de formato (no de diseño visual)

La primera pieza real —"El negocio de las VPN: lo que cuestan, lo que prometen y lo
que de verdad hacen"— vive en `docs/investigaciones/`:
- `2026-08-15-vpns-marketing-vs-realidad.md` — texto fuente.
- `2026-08-15-vpns-marketing-vs-realidad.reference.html` — export standalone con su
  propio diseño (paleta, tipografía, parallax). **Ese HTML es solo referencia de
  qué tipo de elementos incluye (gráficas SVG animadas al hacer scroll, radar
  comparativo, chips de propiedad corporativa, flags de confianza por cita,
  metodología colapsable, lista de fuentes numerada) — el diseño final en el sitio
  debe seguir el sistema visual de kilowatto.com (mismo que usan `columnas`), no
  copiar esta hoja de estilos.**

## Requisitos confirmados por Esteban (2026-08-20)

- Larry (el sistema de marca/autopost) debe conocer las investigaciones **a
  detalle** — no solo un resumen superficial como pasa hoy con `columnVoiceSamples`
  en `brand-voice.ts` (últimas 6 columnas, 500 caracteres cada una). El nivel de
  detalle exacto que necesita Larry quedó como pregunta abierta (ver más abajo).
- Deben tener **comentarios**.
- Deben poder **compartirse**.
- Deben llevar **imágenes generadas con "nano banana"** (Gemini / Google AI
  Studio — `GOOGLE_AI_STUDIO_KEY`, ver `generateWithGemini` en
  `src/lib/brand-image.ts`), a diferencia de las columnas, que usan Recraft.
- Deben llevar **muchas gráficas y tablas interactivas**.
- El formato visual debe ir acorde al resto del sitio, no ser una página aislada.
- Debe ser "super amigable" con SEO, GEO (respuestas de motores de IA/AI Overviews)
  y datos estructurados (JSON-LD: `Article`/`Report`, `FAQPage`, `Dataset` para las
  gráficas si aplica) — igual que columnas ya hace con su `Article` schema, pero
  llevado más a fondo dado que investigaciones cita fuentes primarias verificables
  (ideal para GEO). Esto en **todos los idiomas** del sitio.

## Cómo columnas resuelve problemas equivalentes (para no reinventar)

- Esquema D1: tabla propia (`columns`) + `translations` genérica (`entity_type`) +
  `comments` genérica (`column_id` FK) + `comment_bans` compartida.
- Contexto para Larry: `buildVoiceContext()` en `src/lib/brand-voice.ts` hace un
  `SELECT` de las últimas N columnas y les pasa un extracto a Larry con una
  etiqueta explicando para qué sirve ese bloque en el prompt.
- Gráficas: **hechas a mano en SVG** (`src/lib/column-infographic.ts`), no
  generadas por IA — un modelo de imágenes no puede renderizar texto/números de
  forma confiable. La pieza de VPN sigue el mismo criterio (SVG a mano + reveal al
  hacer scroll, sin librería externa). Este patrón se debe replicar para
  investigaciones: componentes de gráfica reutilizables que reciban datos, no
  imágenes generadas.
- Compartir: `ColumnShare.astro` (botón de LinkedIn + copiar caption sugerido).
- Flujo editorial: `pending_approval` → aprobar/rechazar desde `/admin/columnas`,
  con feedback registrado para aprendizaje.

## Preguntas abiertas

Ver la conversación del 2026-08-20 para las 12 preguntas de diseño planteadas a
Esteban (nombre/URL, si esta pieza de VPN es ya el contenido real o solo
referencia, quién redacta las investigaciones futuras, alcance exacto del
conocimiento de Larry, RAG/Vectorize, sistema de flags de confianza por cita,
reutilización de `comments`/`translations`, cuántas imágenes y quién las aprueba,
metodología/fuentes visibles siempre, índice de navegación por lo largas que son,
y si se traducen a los 12 idiomas o solo viven en español). Actualizar este
documento con las respuestas antes de empezar a construir.

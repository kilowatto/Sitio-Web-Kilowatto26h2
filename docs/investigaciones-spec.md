# "A fondo" — spec de la nueva sección de investigaciones

Nueva sección de contenido, hermana de "Columnas" pero de otra escala: piezas de
investigación profunda (varias semanas de trabajo, decenas de fuentes, metodología
documentada), no columnas de opinión cortas. Nombre de la sección: **"A fondo"**
(posiblemente "A Fondo con Kilowatto" como marca — confirmar el display name
exacto antes de construir el header/logo de sección). URL: `/a-fondo/[slug]`.

Todas las decisiones abajo se tomaron interactivamente con Esteban el 2026-08-20.
Nada de esto se ha construido todavía — este documento es la fuente de verdad para
cuando se empiece a implementar.

## Referencia de formato (no de diseño visual)

La primera pieza real —"El negocio de las VPN: lo que cuestan, lo que prometen y lo
que de verdad hacen"— **sí se publica** como el primer "A fondo" en cuanto la
sección exista. Vive en `docs/investigaciones/`:
- `2026-08-15-vpns-marketing-vs-realidad.md` — texto fuente, en español.
- `2026-08-15-vpns-marketing-vs-realidad.reference.html` — export standalone con su
  propio diseño (paleta, tipografía, parallax). **Ese HTML es solo referencia de
  qué tipo de elementos incluye (gráficas SVG animadas al hacer scroll, radar
  comparativo, chips de propiedad corporativa, flags de confianza por cita,
  metodología colapsable, lista de fuentes numerada) — el diseño final en el sitio
  debe seguir el sistema visual de kilowatto.com (mismo que usan `columnas`), NO
  copiar esta hoja de estilos ni su paleta/tipografía.**

## Autoría y flujo editorial

- **Esteban sigue redactando/investigando** cada pieza (con las herramientas que
  use, ej. Fable) — Claude no genera investigaciones de punta a punta como Larry
  hace con columnas. El trabajo de Claude es: publicar, formatear al sistema
  visual del sitio, generar las gráficas/tablas a partir de los datos, generar
  las imágenes, armar el SEO/structured data, y traducir.
- Por lo mismo, no hay (por ahora) flujo de "generar con IA → pending_approval"
  como en columnas — el punto de entrada es Esteban entregando un texto ya
  investigado (probablemente en Markdown, como el de referencia).

## Larry debe conocerlas a detalle

- No basta un extracto corto como `columnVoiceSamples` (500 caracteres). Larry
  debe poder **citar datos y cifras específicas** de una investigación al
  escribir un post — requiere indexar el contenido completo, no solo un resumen,
  en el contexto que se le da al generar posts.
- **Tracking de clics por cita**: cada liga de fuente citada dentro de una
  investigación necesita registrar cuando le dan click — llevar un conteo por
  fuente/cita, no solo un conteo agregado.
- **Conteo de vistas**: mismo mecanismo que ya usan columnas —
  `display_seed` (número base cosmético, no empieza en 0) + `view_count` real
  por separado (`columns-query.ts`: `displayViewCount()` / `incrementColumnView()`).
  Replicar el mismo patrón para "A fondo".

## RAG / chatbot

- Sí: indexar el contenido en Vectorize para que el chatbot del sitio pueda
  responder preguntas citando estas investigaciones.

## Gráficas y tablas

- Componentes reutilizables alimentados por datos (barra, cronología, radar,
  tarjetas de comparación/propiedad), no código a mano por cada pieza. Mismo
  criterio que ya usa `column-infographic.ts` para columnas: SVG hecho a mano,
  NO generado por IA — los modelos de imágenes no renderizan texto/números de
  forma confiable. Construir el set de componentes una vez; cada investigación
  futura solo les pasa datos.

## Flags de confianza por cita (🟢🟡🔴)

- Se adoptan como **estándar en toda investigación futura** — refuerzan rigor
  editorial y ayudan a GEO (verificación explícita por dato citado).
- Debe existir una **página de metodología fija, aparte** (ej.
  `/a-fondo/metodologia`), enlazada desde cada pieza, que explique el semáforo y
  el proceso general de investigación — es la guía maestra para cualquier
  investigación que se haga. Cada pieza individual lleva solo una nota corta de
  "cómo se investigó esta en particular" (líneas de investigación, número de
  fuentes) con un link a esa guía general, en vez de repetir la explicación
  completa cada vez.

## Comentarios

- Reusar el mismo sistema que columnas: tabla `comments` genérica, moderación y
  anti-spam/IP-ban ya existentes — solo cambia la FK (`investigacion_id` en vez
  de `column_id`).

## Compartir

- Imagen de portada con **texto superpuesto**, pensada para compartirse en
  WhatsApp, LinkedIn, Facebook y otros — no solo la foto de portada pelona.
- Debe ser **trackeable por fuente**: parámetros UTM (o equivalente) distintos
  por plataforma de origen, para saber de dónde viene cada visita/clic.

## Imágenes (Gemini / "nano banana")

- Portada + una imagen por sección grande dentro del cuerpo.
- **Aprobación manual** antes de publicarse — igual que hoy se aprueban las
  imágenes de columnas, no automático sin revisión.
- Usa `GOOGLE_AI_STUDIO_KEY` / `generateWithGemini()` (`src/lib/brand-image.ts`),
  a diferencia de columnas que usa Recraft.

## Índice de navegación (TOC) — diseño scroll-spy

Dado lo largas que son estas piezas (~22 min de lectura la de VPN):

- **Señal visual de la sección activa**: combinar tamaño (crece) + intensidad de
  color, según qué tan cerca esté del centro del viewport mientras se hace scroll.
- **Escritorio**: aparece fijo (`position: sticky`) desde el inicio de la pieza,
  justo debajo del resumen ejecutivo, ocupando la columna izquierda que hoy queda
  vacía en pantallas anchas.
- **Móvil**: barra horizontal de chips deslizable (scroll horizontal), fija justo
  debajo del header, con la sección activa resaltada — no es un menú hamburguesa
  que hay que abrir, siempre está visible.
- **También muestra progreso de lectura** (% o minutos restantes), no solo los
  nombres de sección — hay que mantener esto consistente en los 12 idiomas (el
  tiempo estimado cambia según la longitud de cada traducción).

## Traducción e idiomas

- **Cuerpo completo traducido a los 12 idiomas** del sitio (igual que columnas),
  no solo título/resumen/metadatos.
- Debe ser "super amigable" con SEO, GEO (respuestas de motores de IA/AI
  Overviews) y datos estructurados (JSON-LD: `Article`/`Report`, `FAQPage`,
  posiblemente `Dataset` para las gráficas) en **todos los idiomas** — más a
  fondo que el `Article` schema que ya usan columnas, dado que estas piezas citan
  fuentes primarias verificables (ideal para que un motor de IA las cite).

## Cómo columnas resuelve problemas equivalentes (para no reinventar)

- Esquema D1: tabla propia (`columns`) + `translations` genérica (`entity_type`)
  + `comments` genérica (`column_id` FK) + `comment_bans` compartida.
- Contexto para Larry: `buildVoiceContext()` en `src/lib/brand-voice.ts`.
- Compartir: `ColumnShare.astro` (botón de LinkedIn + copiar caption sugerido) —
  para "A fondo" hay que extenderlo (imagen con texto + más plataformas + UTM).
- Flujo editorial de columnas (`pending_approval` → aprobar/rechazar desde
  `/admin/columnas`) NO aplica igual aquí, porque Esteban redacta el contenido
  base — el flujo de "A fondo" es más parecido a "importar texto ya escrito →
  Claude genera gráficas/imágenes/SEO/traducciones → Esteban aprueba imágenes."

## Estado: v1 construido y en producción (2026-08-21)

Lo siguiente ya está desplegado y verificado en vivo en kilowatto.com:

- Esquema D1 (`investigaciones`, `investigacion_sources`, `investigacion_charts`,
  `comments` con `investigacion_id` además de `column_id`, `short_links` con
  `investigacion_id`) — migración `0056_investigaciones.sql`.
- Importador reutilizable `scripts/import-investigacion.mjs`: convierte un
  Markdown como el de `docs/investigaciones/` en filas estructuradas — gráficas
  detectadas por tipo de tabla, citas convertidas a `kilowatto.com/r/xxxx` con
  su flag de confianza, bibliografía de fuentes.
- 4 componentes de gráfica reutilizables (`src/components/charts/`): barra
  (simple y agrupada), cronología, radar con leyenda interactiva, tarjetas de
  comparación — todo SVG/CSS a mano, nada generado por IA.
- Índice lateral con scroll-spy real (por posición de scroll, no solo
  IntersectionObserver — ver nota de bug abajo), barra de chips en móvil,
  progreso de lectura.
- Página de metodología fija (`/a-fondo/metodologia`) enlazada desde cada pieza.
- Comentarios y compartir (WhatsApp/LinkedIn/Facebook + UTM por plataforma)
  reusando y generalizando la infraestructura de columnas.
- Portada generada con Gemini vía `/api/investigaciones/[id]/generate-cover`
  (token-gated, mismo patrón que el resto del admin).
- Larry: `buildVoiceContext()` ahora trae un extracto de 4000 caracteres (no
  500) de las últimas 2 investigaciones publicadas, etiquetado para que pueda
  citar cifras reales al escribir posts.
- Primera pieza (VPN) publicada como el lanzamiento real de la sección.

**Dos bugs reales atrapados antes de mostrarlo** (con Playwright en
390/800/1900px, siguiendo la lección de la página de comida): un track de grid
sin `minmax(0, ...)` dejaba que la barra de chips del índice (que no rompe
línea) estirara toda la página a ~5500px de ancho en móvil; y
`white-space: nowrap` en las citas largas hacía lo mismo en pantallas angostas.
Ambos corregidos.

## Pendiente (fast-follows, explícitamente no construidos en este v1)

- **Imagen de portada con texto superpuesto para compartir** — se explora con
  `satori`/`resvg` (renderizado de SVG+texto a PNG en el Worker, ya que los
  modelos de imagen no dibujan texto de forma confiable). Por ahora, compartir
  usa links con UTM + la portada normal como preview.
- **Indexar en Vectorize/RAG** para que el chatbot pueda citar investigaciones.
- **Traducción completa a los 12 idiomas** — el link del menú está limitado a
  es-MX por ahora (mismo patrón que `/biblioteca`). Cuerpo muy largo para el
  patrón de traducción-al-vuelo de páginas estáticas; necesita traducción por
  bloque/sección guardada en la tabla `translations`, como columnas.
- **Imágenes por sección** (Gemini) — hoy solo se generó la portada.
- Confirmar el display name exacto: "A fondo" vs "A Fondo con Kilowatto".
- Flujo de ingesta en `/admin` (hoy el importador se corre manualmente desde
  la terminal) — falta una UI para que futuras piezas no dependan de Claude
  corriendo el script a mano.

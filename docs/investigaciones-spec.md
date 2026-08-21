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

## Pendiente antes de construir

- Confirmar el display name exacto: "A fondo" vs "A Fondo con Kilowatto".
- Diseñar el esquema D1 (tabla propia + cómo se relacionan gráficas/citas/fuentes
  con tracking de clics por cita).
- Decidir el flujo concreto de ingesta: ¿Esteban pega el Markdown en un campo de
  `/admin`, o sube el archivo, y de ahí Claude/el sistema genera todo lo demás?

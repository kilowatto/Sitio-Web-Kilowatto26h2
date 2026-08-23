# Medios: audio narrado, infografías animadas y videocolumnas

> Estado vivo del proyecto. Plan original y las 26 decisiones: acordadas con Esteban el
> 2026-08-21/22. Este archivo es la fuente de verdad — actualízalo al cerrar cada fase.
>
> Última actualización: 2026-08-23 (feeds de podcast validados)

## Por qué

kilowatto.com publicaba solo texto e imágenes. La meta es convertir cada pieza en audio
narrado, infografías animadas y videocolumnas, para ganar alcance en redes, YouTube y podcast.
Referencia visual: [este video](https://www.youtube.com/watch?v=0swxMbThNug) (Lorena Bordonaba,
2026-08-18) — infografías verticales animadas con Claude Code + Remotion + Simple Icons.

---

## Estado por fase

| Fase | Estado | Qué falta |
|---|---|---|
| 1 · Audio en español | ✅ **Terminada** | — |
| 1b · Audio en inglés | ✅ **Terminada** | — |
| 2 · Gráficas interactivas | ❌ Sin empezar | Isla `client:visible` sobre los 14 SVG existentes |
| 3 · Clips cortos 60-90s | ❌ Sin empezar | Remotion + Containers + publicación a X/LinkedIn |
| 4 · Videocolumna con Larry | ⏳ Riesgo resuelto, sin construir | Cara final, character bible, LoRA, pipeline |

### Diferido a propósito
Los otros 10 locales, GIF animado.

### Podcast

Dos feeds, uno por idioma, porque `<language>` es un tag de canal:
`/podcast.xml` (es-MX) y `/en/podcast.xml`, ambos con 23 episodios y certificación PSP-1 en
Podbase. Construidos en `src/lib/podcast-feed.ts`; portada en `/podcast-cover.jpg`
(1500×1500 JPEG, RGB, sin alfa). **Falta el alta manual** en Apple Podcasts Connect y Spotify
for Creators — solo Esteban puede hacerla.

Dos cosas que un validador marca en rojo y conviene entender antes de "arreglarlas":

- **"Byte-range support: ✗"** no era de los episodios. Los 46 enclosures responden 206 a
  cualquier forma de `Range` (probado uno por uno); el validador corre la sonda contra **la URL
  del feed** que le diste. Se resolvió sirviendo rangos también desde el feed — son 20 KB que
  ya están en memoria.
- **ETag y Last-Modified** en el feed no son cosmética: Apple y Spotify lo consultan para
  siempre, y un 304 cambia una consulta a D1 por una comparación de encabezados. El ETag es un
  FNV-1a del cuerpo; el `Last-Modified` sale del episodio más reciente, no de `now()`, o cambiaría
  en cada petición y no serviría de nada.

---

## Fase 1 — Audio narrado ✅

**46 piezas en total, 7.2 horas**, todas con sincronía de párrafo y reproductor en su ruta.

| | Piezas | Horas | Cobertura de sincronía |
|---|---|---|---|
| `es-MX` | 23 | 3.9 h | 95% promedio |
| `en` | 23 | 3.3 h | 75% promedio (min 49%) |

La cobertura en inglés es menor y la razón es estructural: en español el guion y el artículo
comparten idioma y ~90% de las palabras, así que las anclas casan casi directo. En inglés hay
dos reescrituras encima (traducción, luego adaptación) y las anclas se despegan más. El efecto
es más huecos en el resaltado, nunca resaltar el párrafo equivocado. Bajar el umbral subiría la
cobertura a costa de emparejar mal — no se hizo a propósito.

### Piezas y dónde viven

| Qué | Dónde |
|---|---|
| Adaptación a guion | `src/lib/audio-script.ts` |
| Síntesis, caché, alineación | `src/lib/elevenlabs.ts` |
| Orquestación por pieza | `src/lib/narrate.ts` → `/api/admin/narrate` |
| Mapa de párrafos | `src/lib/cue-map.ts` → `/api/admin/build-cues` |
| Reproductor | `src/components/AudioPlayer.astro` |
| Telemetría | `/api/audio-event` → dataset `kilowatto_audio_events` |
| Dashboard | `src/pages/admin/audio.astro` (Más → Audio) |
| Consultas de telemetría | `src/lib/audio-telemetry.ts` |
| Diccionario de pronunciación | `/api/admin/pronunciation-dict`, locators en KV |
| Tabla | `media_assets` (migraciones 0061, 0062) |

### Decisiones que costaron aprenderse

Estas se descubrieron rompiendo cosas. No las revierta nadie sin releer el porqué.

1. **Trozos de 9,000 caracteres, no 2,000.** Los cortes son donde se pierde la calidad del
   audio. Encadenarlos mantenía la cadencia pero acumulaba pérdida de energía a lo largo del
   artículo; no encadenarlos mantenía la energía pero rompía la cadencia en cada costura. La
   solución fue eliminar costuras: una columna típica cabe en **una sola llamada**.

2. **`stability: 0.40`**, elegido en una comparación a ciegas de cuatro variantes. 0.55 sonaba
   plano. `style` se queda en 0 — 0.35 sonaba sobreactuado.

3. **Etiquetas `<break>` en las costuras estructurales** (título 1.2s, subtítulo 1.5s,
   encabezado 0.8s, párrafo 0.6s). Un punto y aparte es invisible para quien escucha. Se
   insertan **después** del guardián de cifras, para que el `1.2` de la etiqueta no se lea como
   dato inventado.

4. **La IA adapta la redacción, nunca los números.** `findInventedNumbers()` compara cada
   sección contra su fuente y, si detecta una cifra inventada, cae al texto original en vez de
   publicar. Razón: el benchmark ChartHal mide GPT-5 en ~34% de acierto leyendo gráficas.

5. **Sincronía por párrafo, no por palabra.** El guion es adaptado: conserva ~90% de las
   palabras pero une frases y agrega conectores. Suficiente para resaltar la palabra equivocada.

6. **Alineación por anclas, no partiendo el guion.** La primera versión partía el guion por sus
   etiquetas `<break>` — 25% de cobertura, varias piezas en 0%, porque el audio generado antes
   de que existieran esas etiquetas colapsaba en un solo bloque. Recorrer el flujo de palabras
   cronometradas buscando dónde arranca cada párrafo del artículo: **95%**.

7. **Alineación por trozos para audio largo.** `alignAudio()` carga el MP3 completo: 9 MB de
   una columna cabe, 90 MB de una investigación revienta el isolate de 128 MB. `alignLongAudio()`
   alinea trozo por trozo con desfase acumulado. No hizo falta guardar nada nuevo: `chunkScript()`
   es determinista y la llave de caché se puede reconstruir del guion guardado.

8. **Idempotencia por existencia, no por hash del guion.** El guion lo genera un LLM y no es
   determinista, así que el hash nunca coincidía y cada relanzamiento re-cobraba todo creyendo
   que ahorraba.

9. **`COUNT(*)` no existe en Analytics Engine** — exige `COUNT()`. Tres de las cuatro consultas
   del dashboard lo usaban, y como cada una devuelve `null` en `catch`, la página habría dicho
   "aún no hay datos" en vez de fallar. **Si ves el dashboard vacío teniendo tráfico, sospecha
   de esto primero.**

10. **"Horas escuchadas" necesita id de sesión.** Sumar la posición de cada evento cuenta a un
    oyente que llega al minuto 7 como 1,000 segundos de una escucha de 400. Se toma el máximo
    por sesión (`blob8`). El id no es de usuario y no se persiste.

11. **Localización: el guion se lee de `translations`, y el prompt va en el idioma destino.**
    Dos fallas encadenadas, ambas silenciosas. Primero `buildAudioScript()` leía `body_html` de
    la tabla de contenido, que siempre está en español — habría narrado español con voz inglesa.
    Y aun arreglado eso, el prompt estaba escrito en español pidiendo salida "en inglés": el
    modelo respondía en español, y **la pieza abría en inglés** porque título y subtítulo no
    pasan por el modelo. Se revertía a partir del primer párrafo. Lo mismo aplica a
    `build-cues`, que comparaba narración inglesa contra párrafos españoles.

12. **`/api/translate?columnId=N`** existe porque el endpoint completo regenera todas las
    traducciones, y el audio y sus cues están construidos contra un texto específico:
    reemplazarlo deja el audio diciendo una cosa y la página mostrando otra.

13. **El bloque de firma no se narra.** Leído en voz alta quedaba "…se puede encontrar en
    LinkedIn y Wikidata, y también en la red social X…". Se identifica por el marcador de
    Wikidata, igual que ya hacen el traductor y el colocador de imágenes.

---

## Fase 4 — Lo que ya sabemos de Larry en video

El riesgo #1 del plan está **resuelto**: HeyGen sí puede animar a Larry, con una condición.

| Variante | Detección |
|---|---|
| Avatar actual (perfil 3/4, hocico largo) | ❌ |
| Frontal, hocico real de rinoceronte | ❌ |
| Morro corto y ancho, boca humana al frente | ✅ |
| Cara de proporciones humanas | ✅ |

**El umbral es la geometría del hocico, no el ángulo de cámara.** Un barrido de ángulos
(15°/30°/45°) dio 15% ❌, 30% ✅, 45% ❌ — no es un umbral limpio, así que **no existe un
"ángulo correcto" que programar**: la detección depende de cómo salió cada imagen concreta.

**La detección de cara rechaza antes de cobrar**, así que iterar el diseño del personaje es
gratis y solo un candidato que pasa cuesta un render. Herramientas en `/api/admin/larry-face-lab`
y `/api/admin/heygen-test`.

Otros hechos verificados: HeyGen v3 (v1/v2 se retiran 2026-11-01); con `type:"image"` el motor
Avatar IV es implícito y mandar `engine` da 400; rechaza PNG por URL pese a documentar JPG/PNG;
acepta audio de ElevenLabs vía `audio_asset_id`. Synthesia y D-ID quedan descartados de raíz
(solo caras humanas).

---

## Restricciones que no cambian

1. **Remotion nunca correrá en Workers.** Un isolate de V8 no tiene modelo de procesos y
   Remotion lanza Chrome y un binario nativo. Lo mismo para `ffmpeg.wasm`. El render va en un
   **Container**; el Worker solo orquesta.
2. **El sitio no tiene React.** Remotion lo exige → workspace aparte, jamás dentro de la app.
3. **Licencia de Remotion: $0** para ≤3 personas que la operen. Cuenta contratistas.
4. **X:** 140 s máximo, $0.015 por post y **$0.20 si lleva URL** → el link va en respuesta aparte.
5. **LinkedIn:** reautorización manual en navegador **cada 60 días, para siempre**. Sin alarma a
   T-7 el pipeline se cae en silencio.
6. **CC0 de Simple Icons no cede derechos de marca.** AWS y Microsoft lo prohíben por escrito.
   Uso funcional, con el hex oficial, nunca animado. Evitar Font Awesome Free y los 52 sets
   CC BY 4.0 de Iconify: al rasterizar a MP4 no sobrevive la atribución.

## Trampas del repo

1. **`src/lib/column-layout.ts` `BLOCK_RE`** — cualquier tag de nivel superior que no esté ahí
   **se borra en silencio**. Por eso el reproductor va como componente hermano, no dentro de
   `body_html`.
2. **`src/lib/investigacion-translate.ts` `BLOCK_RE`** — debe tratar media nueva como opaca.
3. **CSS con scope + `innerHTML`:** Astro agrega `[data-astro-cid-*]` a selectores y a elementos
   del template; lo creado por JS nunca lo recibe y **ninguna regla aplica**. Usar
   `.padre :global(.hijo)`.
4. **Nunca `wrangler deploy` a secas** — se salta el build. Usar `npm run deploy`.
5. El binding de un Workflow **no** va en `wrangler.jsonc` (rompe `astro dev`).

## Costos reales medidos

| | |
|---|---|
| Columna (~6k chars) | ~$0.60, ~6 min de audio |
| Investigación (~25k chars) | ~$2.50, ~28 min |
| Backfill completo español | ~$22 |
| Backfill completo inglés | ~$24 |
| El inglés dura ~10% menos que el español al mismo texto | — |
| Render HeyGen | ~$0.05/segundo (~$3/min) |
| API de X | ~$3/mes a 1-2 clips por semana |

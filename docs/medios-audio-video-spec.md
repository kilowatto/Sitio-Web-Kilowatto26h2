# Medios: audio narrado, infografías animadas y videocolumnas

> Estado vivo del proyecto. Plan original y las 26 decisiones: acordadas con Esteban el
> 2026-08-21/22. Este archivo es la fuente de verdad — actualízalo al cerrar cada fase.
>
> Última actualización: 2026-08-23 (podcast publicado, telemetría de descargas, monitor)

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
| 2 · Gráficas accesibles | ✅ **Terminada** | — |
| Podcast (feeds + alta) | ✅ **Terminada** | — |
| Podcast conversado | ✅ **Terminada** | — |
| Descargas y monitor | ✅ **Terminada** | Llave de Podcast Index para vigilar Apple (opcional) |
| 3 · Clips cortos 60-90s | 🔍 Infraestructura verificada | Ver "Fase 3" abajo: plan de 7 pasos |
| 4 · Videocolumna con Larry | ⏳ Riesgo resuelto, sin construir | Cara final, character bible, LoRA, pipeline |

### Decidido: el audio es solo español e inglés

Esteban lo confirmó el 2026-08-23. **No es un pendiente, es una decisión**: los otros 10 locales
no llevan audio por ahora, aunque las traducciones estén completas y el pipeline funcione.

La razón para no hacerlo es que cuesta ~$220 y no había ninguna evidencia de demanda. Eso ya
cambió: desde hoy se cuentan las descargas reales por idioma, así que la próxima vez que se
plantee habrá números en vez de intuición. Si se revierte, el backfill son dos comandos — el
barrido de `audio-sweeper.ts` toma los locales de su constante `LOCALES` y nada más.

### Diferido a propósito
GIF animado.

### Podcast

Dos feeds, uno por idioma, porque `<language>` es un tag de canal: `/podcast.xml` (es-MX) y
`/en/podcast.xml`, con certificación PSP-1 en Podbase. Portada en `/podcast-cover.jpg`
(1500×1500 JPEG, RGB, sin alfa). **Falta el alta manual** en Apple Podcasts Connect y Spotify
for Creators — solo Esteban puede hacerla.

Dos cosas que un validador marca en rojo y conviene entender antes de "arreglarlas":

- **"Byte-range support: ✗"** no era de los episodios. Los enclosures responden 206 a cualquier
  forma de `Range` (probado uno por uno); el validador corre la sonda contra **la URL del feed**
  que le diste. Se resolvió sirviendo rangos también desde el feed.
- **ETag y Last-Modified** no son cosmética: Apple y Spotify consultan para siempre, y un 304
  cambia una consulta a D1 por una comparación de encabezados. El `Last-Modified` sale del
  episodio más reciente, no de `now()`, o cambiaría en cada petición.

---

## Publicación en directorios

| | Spotify | Apple |
|---|---|---|
| es-MX · Al fondo con Kilowatto | en vivo | `id6804514606` |
| en · Deep Dive with Kilowatto | en vivo | `id6804533284` |

Enlaces y badges en `src/lib/podcast-links.ts` + `src/components/PodcastLinks.astro`.

**Trampas del alta, todas verificadas en vivo:**

1. **`itunes:email` no está en la lista de tags obligatorios de Apple pero es indispensable.**
   Spotify manda ahí el código de 8 dígitos y no hay otra forma de probar la propiedad de un feed
   autohospedado. Sin él, todos los validadores pasan y **la alta falla días después** con un
   mensaje que no dice por qué.
2. **`--` dentro de un comentario XML tumba el feed entero.** Pasó en producción al agregar
   `itunes:owner`. `xmlComment()` lo neutraliza.
3. **La portada se cachea por URL.** Reemplazar la imagen en R2 es invisible para Apple y Spotify;
   solo `?v=N` en `itunes:image` fuerza la relectura. Súbelo en cada cambio de portada.
4. **Los guid son la identidad permanente de un episodio.** Al agregar el tipo conversado pasaron
   a llevar sufijo, lo que habría republicado los 23 episodios como nuevos. El sufijo va solo en
   la conversación.
5. **URLs de Apple en forma corta**, `podcasts.apple.com/podcast/id{N}`. La que Apple entrega
   lleva el nombre como slug y ese slug se queda viejo al renombrar.
6. **Un error genérico de Apple al añadir el RSS suele ser de Apple.** "Vuelve a intentarlo más
   tarde" no es un problema del feed; cuando el feed está mal, Apple dice cuál tag falta.

**Abierto:** Apple mostró 9 de 26 episodios durante horas tras publicar. Si persiste, es ticket
con soporte — desde aquí los 26 responden 206 a Range.

## Descargas y monitor

**Ninguna plataforma da estadísticas de escucha por API.** Apple documenta que su API de Podcasts
Connect no da acceso a analíticas; la de Spotify exige cuenta de equipo con permiso de Analytics
Reader y se reporta devolviendo vacío. Se descartaron las dos.

Se cuentan en nuestro servidor, que es como mide la industria: el conteo IAB es conteo de
descargas del servidor, y como el audio lo servimos nosotros cubre cualquier app, incluidas
aquellas donde nunca nos dimos de alta.

| Qué | Dónde |
|---|---|
| Escritura por petición | `src/lib/podcast-download-log.ts`, desde `media/video/[...key].ts` |
| Consultas con deduplicado | `src/lib/podcast-downloads.ts` |
| Monitor de feeds y directorios | `src/lib/podcast-monitor.ts` → `/api/admin/podcast-check` |
| Ambas vistas | `src/pages/admin/audio.astro` |
| Dataset | `kilowatto_podcast_downloads` (binding `DOWNLOAD_ANALYTICS`) |

**La regla de conteo es toda la función.** Una escucha son decenas de peticiones parciales:
contarlas crudas infla por un orden de magnitud, contar oyentes únicos subestima a quien escucha
dos veces. Una descarga = un oyente que se llevó ≥1 minuto de audio (1,440,000 bytes a 192 kbps)
de una pieza en un día. Eso además excluye los pocos KB que cada directorio pide en cada sondeo
para leer las etiquetas ID3. Medido: 7 peticiones crudas → 3 descargas.

Al oyente lo identifica un hash de IP + user-agent + **el día** + secreto. La regla necesita
reconocer peticiones repetidas; no necesita una identidad, y salar con la fecha impide ligarlas
entre días.

### Lo que el monitor enseñó al primer intento

1. **Un `fetch()` a nuestro propio hostname desde el isolate devuelve 522.** Sale al edge y
   regresa. Es la misma trampa por la que existe `callSelf`. Ahora hay un service binding `SELF`,
   declarado post-build igual que los Workflows porque en `wrangler.jsonc` rompe `astro dev`.
2. **Apple responde 403 a los rangos de IP de Cloudflare.** El lookup de iTunes funciona desde una
   laptop y nunca desde el Worker. Esa comprobación es *aviso*, no falla: un semáforo
   permanentemente rojo es un semáforo que nadie lee.
3. **Un validador de feeds certifica transcripciones rotas.** Podbase dio PSP-1 con las 26 URLs de
   `podcast:transcript` del feed en inglés devolviendo 404, porque comprueba que el tag **esté**,
   no que la URL **resuelva**. Seguir cada enlace es la única forma de saberlo, y es la razón
   principal de que el monitor exista.

## Podcast conversado — "Al fondo con Kilowatto"

Las investigaciones narradas duran 27, 27 y **64 minutos**. Esteban intentó escuchar la suya y no
pudo. Las columnas, a ~6 minutos, se quedan como narración y no las toca nada de esto.

**6 episodios en producción.** El feed lleva las dos versiones de cada investigación.

| ep | es-MX | en | narrado es-MX | compresión |
|---|---|---|---|---|
| 1 · VPN | 11:33 | 7:25 | 29:47 | 2.6:1 |
| 2 · El péndulo | 8:42 | 6:54 | 26:51 | 3.1:1 |
| 3 · IA en la universidad | 17:31 | 8:55 | 64:15 | 3.7:1 |

Costo real: **~$9** los seis, a $0.000184/carácter en `eleven_v3` (1.8× lo que cuesta
`multilingual_v2`).

### Personajes y voces

| | Quién | Voz | Dónde sale |
|---|---|---|---|
| **Kilowatto** | La marca, presentando su propia investigación | Rafael (profesional, mx) | Solo podcast |
| **Leia** | La avestruz de Esteban, "la sociable y curiosa" | Dani - Podcast Host (mx) | Solo podcast |
| Locutora | Lee el ident | Marisol (mx) | Solo podcast |
| **Larry** | El rinoceronte | voz `kilowatto` clonada | Columnas y lecturas completas |

### Estructura del episodio

```
[apertura en frío]  pregunta → respuesta segura y equivocada → dato que la rompe → sin resolver
[sting + locutora]  "Al fondo con Kilowatto. Episodio N. TEMA."
[saludo]            Kilowatto entra emocionado: "vamos directos al fondo"
[6-9 hallazgos]     uno por sección elegida, con el guardián de cifras por hallazgo
[cierre]            Leia manda a A fondo en kilowatto.com
```

### Decisiones que costaron aprenderse

1. **El clon instantáneo no aguanta v3.** La voz `kilowatto` se hizo para `multilingual_v2` y
   ElevenLabs recomienda clones profesionales para v3. En v3 salió plana, y `stability: 0` no lo
   arregló porque la planitud era el clon, no el ajuste. Por eso el podcast tiene conductor
   propio con voz profesional y Larry se quedó intacto en la narración.

2. **Estéreo + mono = ardillitas.** Cada frame MP3 lleva su modo de canal y el decodificador lo
   fija con el primero que ve. `/v1/music` devuelve estéreo y las voces son mono, así que el
   locutor se reproducía al doble de velocidad. **No se arregla en runtime** — un isolate no
   tiene codificador. El sting se convirtió offline (`ffmpeg -ac 1`) y `isMonoMp3()` ahora lo
   verifica antes de ensamblar: si está en estéreo, se omite la música con una advertencia.

3. **La apertura en frío tiene mecanismo, no estilo.** Loewenstein (1994): la curiosidad exige
   que ya sepas lo suficiente para notar el hueco. Muller (tesis 2008, el PhD de Veritasium): una
   explicación clara deja a la gente igual de equivocada pero más segura — hay que sacar la
   creencia falsa primero. Por eso esos turnos son **plantilla y no salida del modelo**:
   "explica, pero párate antes de explicar" es justo la instrucción que un modelo ignora.

4. **El guardián de cifras rechazaba adaptaciones correctas.** La fuente escribe "veinte años" con
   letra, el modelo pone "20", y el guardián —que solo comparaba dígitos y corre por sección— lo
   llamaba invención. Ahora recolecta también los números escritos con letra.

5. **El respaldo del esquema escondía una falla sistemática.** Con 15 secciones, nueve hallazgos
   no cabían en `max_tokens: 1024`, el arreglo JSON nunca cerraba, y el respaldo tomaba las
   primeras secciones en orden. El episodio se publicaba **sin selección editorial** y solo lo
   delataba una advertencia. Parecía intermitente porque solo la pieza más larga llegaba al tope.

6. **Workers AI no siempre devuelve texto en `response`.** Cuando el modelo emite JSON puede venir
   ya parseado, y `String()` lo vuelve `[object Object]`. Y al arreglarlo, el heurístico de
   bloques de contenido se tragaba los turnos `{speaker, text}`: hay que exigir `type === "text"`.

7. **El modelo etiqueta los turnos con los NOMBRES de los personajes**, no con las llaves del
   esquema. Mapear lo desconocido a `host` volvió los 22 turnos un monólogo de cuatro minutos que
   pasaba todas las demás validaciones.

8. **No fusionar turnos entre hallazgos.** Producía frases que soldaban el cierre de un hallazgo
   con el arranque del siguiente, diciendo algo que ninguna mitad decía.

9. **Los guid de las narraciones no se tocaron.** Al meter el tipo nuevo pasaron a llevar sufijo,
   lo que habría republicado los 23 episodios como nuevos. El sufijo va solo en la conversación.

10. **Un POST sin `Content-Type` da 403**, no 401: es el guard de origen de Astro. Variante nueva
    de la trampa que ya conocíamos para `callSelf`.

### Piezas nuevas

| Qué | Dónde |
|---|---|
| Guion conversado (esquema, gancho, turnos) | `src/lib/dialogue-script.ts` |
| Síntesis v3, sting, locutor, guardián mono | `src/lib/elevenlabs-dialogue.ts` |
| Orquestación por episodio | `src/lib/narrate-dialogue.ts` → `/api/admin/narrate-dialogue` |
| Banco de pruebas (voces, intro, guion) | `/api/admin/dialogue-lab` |
| Transcripción con interlocutores | `/a-fondo/[slug]/conversacion.txt` |
| Tipo y número de episodio | migraciones 0074, 0075 |

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

---

# Fase 3 — Clips verticales, integrados al sistema de posts

> Replanteada el 2026-08-23 por Esteban: **los videos verticales son un formato más del sistema
> de posts automáticos, no un módulo aparte.** Y todo —posts, Remotion, investigaciones,
> columnas, audio— debe ser el gancho para leer más en el sitio.

## El diagnóstico que motivó el replanteo

El sistema de posts existe, funciona y publica solo. No está pausado: publicó en X el
2026-08-23. Las credenciales de X y LinkedIn **sí existen**, cifradas en `brand_api_settings`,
no como secretos de Worker (que es por qué parecían ausentes).

Pero los módulos no se hablan, y los números lo dicen:

| tipo de post | enlazan a kilowatto.com |
|---|---|
| `idea` | 0 / 289 |
| `news_reaction` | 0 / 160 |
| `news_reshare` | 0 / 258 |
| `investigacion_highlight` | 60 / 60 |

**332 posts publicados y solo los de investigaciones mandan a alguien al sitio.** El resto es
comentario que no engancha con nada.

Peor: `brand_posts.kind` no tiene `columna_highlight`, no hay `column_id`, y no existe
`generate-posts.ts` bajo `columns/`. **Las columnas —20 de 23 piezas publicadas— no generan un
solo post.** Solo se usan como muestras de voz en `brand-voice.ts`.

Y el audio es invisible para el sistema: se publicaron 6 episodios y un podcast en dos
directorios sin que saliera un solo post anunciándolo.

```
columnas ──✗── posts        20 piezas que nunca se anuncian
audio    ──✗── posts        6 episodios, cero posts
posts    ──✗── descargas    no se sabe qué post trajo qué escucha
posts    ──✗── remotion     no existe
```

## Infraestructura: verificada el 2026-08-23

| Comprobación | Resultado |
|---|---|
| `wrangler containers list` | responde, sin error de permisos |
| Permisos del token | `containers (write)`, `cloudchamber (write)` |
| Registro de imágenes | accesible, vacío |
| Instancia `standard-3` | 2 vCPU, 8 GiB RAM, 16 GB disco |
| **Remotion en Containers** | **integración oficial**, con repo de ejemplo |
| Docker local | ❌ **no instalado** — único bloqueo real |

Que Remotion tenga integración oficial (`remotion.dev/docs/cloudflare-containers` y
`remotion-dev/cloudflare-containers-demo`) desarma el supuesto más caro del plan original, que
era construir la imagen desde cero. **Pero el demo es una referencia, no software listo**: no
trae autenticación, ni cola, ni límite de tasa, ni reporte de progreso o error al cliente, y
guarda en R2 con nombres aleatorios. Todo eso hay que ponerlo.

**El único bloqueo hoy es que no hay Docker en la máquina de Esteban**, y sin él no se puede
construir ni subir la imagen.

## Plan, paso a paso

Los pasos 1 a 3 no dependen de Remotion ni de Docker, dan resultado inmediato, y son los que
convierten los cuatro módulos en un sistema. Hacerlos primero también significa que cuando
llegue el video, ya tiene dónde encajar.

### Paso 1 — Las columnas generan posts
`columna_highlight` en el CHECK de `kind`, `column_id` en `brand_posts`, y un
`columns/[id]/generate-posts.ts` que espeje el de investigaciones. Se dispara en `approve.ts`,
igual que la traducción. Cierra el hueco más grande: 20 piezas que hoy no se anuncian.

### Paso 2 — El audio genera posts
Cuando `audio-sweeper.ts` termina un episodio, entra a la cola un post con el enlace. Un tipo
nuevo, `audio_highlight`. Para las conversaciones, el gancho ya está escrito: la apertura en
frío es literalmente una pregunta diseñada para que no te puedas ir sin la respuesta.

### Paso 3 — Todo post propio enlaza al sitio, con atribución
`utm_source`/`utm_campaign` en el `source_url`, y leerlos del lado de las descargas y de
`kilowatto_page_views`. Sin esto no se puede responder "qué post trajo escuchas", que es la
pregunta que justifica todo lo demás.

Ojo con el costo: **X cobra $0.015 por post y $0.20 si lleva URL**. El enlace va en una
respuesta aparte, 13× más barato.

### Paso 4 — Docker y la imagen
Instalar Docker (Esteban), partir del demo oficial de Remotion, `wrangler containers build` y
`push`. Aquí se sabe de verdad si la imagen cabe y arranca.

### Paso 5 — Un clip, renderizado y visto
Workspace `remotion/` aparte —el sitio no tiene React y Remotion lo exige— y **una** composición
con datos reales. Se ve, se aprueba o se tira. **Antes de construir orquestación.** El orden
inverso es la trampa: montar Container, cola y publicación para descubrir al final que el clip
no convence.

Recordar las reglas de determinismo de Remotion: nada de `Math.random()`, `Date.now()`,
animaciones CSS, GSAP ni Framer Motion. Todo es `f(useCurrentFrame())`.

### Paso 6 — El video es un post más
`video_r2_key` en `brand_posts` y un `kind` de video. El render alimenta **la misma cola**, pasa
por **la misma aprobación**, lo agenda **el mismo `post-scheduler.ts`** que ya aprende los
mejores horarios de la historia real, y lo publica **el mismo `tick`**. No un pipeline paralelo:
el post de siempre, con video en vez de imagen.

### Paso 7 — Medir y decidir la cadencia
Con los pasos 3 y 6 juntos, la pregunta "¿el video trae más lectores que la imagen?" tiene
respuesta con datos, no con intuición. La cadencia de 1-2 por semana se ajusta con eso.

## Materia prima: la decisión pendiente

```
investigacion_charts   24 datasets verificados
columnas publicadas    20   (9 con infografía, pero son imágenes ya renderizadas)
```

Las barras de las infografías de columna están **escritas a mano, una por columna**, dentro de
`generate-images.ts`. No hay nada consultable detrás.

Esteban pausó el video de investigaciones el 2026-08-23. Eso deja los 24 datasets verificados
del lado apagado y ninguna fuente de datos del lado encendido. **O se reabren las
investigaciones para video, o hay que crear datos estructurados para las columnas.** Es decisión
suya, no un problema técnico.

Lo que sí mejoró desde el plan original: el riesgo de "1-2 h/semana contra diseñar 5-6
plantillas a mano" bajó mucho, porque el lenguaje visual ya existe — 14 tipos de gráfica
renderizados en el sitio con un diseño ya aprobado. Las composiciones pueden espejearlas.

## Pregunta abierta: ¿quién narra?

El plan original decía "la voz de Larry". Hoy Larry narra columnas y **Kilowatto** conduce el
podcast. Un clip social es cara pública de marca, así que probablemente es Kilowatto — pero no
está decidido.

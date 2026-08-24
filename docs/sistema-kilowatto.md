# El sistema Kilowatto — qué existe y qué hace

> Recorrido completo del 2026-08-23, hecho a petición de Esteban antes de replantear las fases
> 3 y 4. **Esto describe lo que HAY, no lo que debería haber.** Las brechas están señaladas
> como tales.
>
> Tamaño: 47,583 líneas · 74 libs · 100 endpoints · 62 páginas · 31 componentes · 41 tablas ·
> 77 migraciones.

## La forma general

Un solo Worker de Cloudflare sirve todo: el sitio público en 12 idiomas, el panel de
administración, la API interna, el podcast y la automatización de marca. No hay backend aparte,
no hay servidor de aplicaciones, no hay proceso largo. Todo lo que tarda vive en un cron o en un
Workflow.

```
Cloudflare Worker (Astro SSR)
├── D1            41 tablas
├── R2 MEDIA      audio, imágenes, PDFs, snapshots de prensa
├── KV            settings, cachés, estado de crons
├── Vectorize ×4  chatbot, aprendizaje de marca, voz de fotos, dedup de fotos
├── Analytics ×4  page_views, audio_events, brand_posts, podcast_downloads
├── Workers AI    Llama 3.3 70B + embeddings bge-m3
└── Images        transformaciones
```

## Los cinco subsistemas

### 1 · Contenido editorial

| | |
|---|---|
| **Columnas** | 26 (20 publicadas). Opinión, ~4-9k caracteres |
| **Investigaciones** ("A fondo") | 3. Piezas largas, 31-72k caracteres, con gráficas verificadas |
| **Traducciones** | 5,305 filas · 11 locales no canónicos |
| **Gráficas** | 24 datasets verificados en `investigacion_charts`, 14 tipos de gráfica |

Al aprobar una investigación se dispara en cadena: portada, imágenes de las secciones, imágenes
de las gráficas, FAQs generadas, posts de marca, reindexado del chatbot y el Workflow de
traducción a los 11 locales. Las columnas hacen lo mismo **menos los posts**.

Trampas conocidas: el `BLOCK_RE` de `column-layout.ts` y de `investigacion-translate.ts` **borra
en silencio** cualquier tag de nivel superior que no esté en el regex.

### 2 · Marca y publicación automática

El subsistema más grande y el que más corre. `tick.ts` se ejecuta **cada 30 minutos entre las
6 y las 23 h**.

```
tick cada 30 min
 ├── runReshare()          reshares de noticias
 ├── runGenerate(x)        rellena la cola de ideas
 ├── runGenerate(linkedin)
 ├── runPublish()          publica lo que toca
 ├── runNewsAutoPublish()  reacciones a noticias, con techo propio
 └── snapshot de seguidores (1×/día)
```

| Dato | Volumen |
|---|---|
| `brand_posts` | **767** (332 publicados: 310 en X, 22 en LinkedIn) |
| `brand_post_metrics` | **23,606** mediciones de engagement |
| `brand_topics` | 74 |
| `news_sources` | 51 fuentes curadas |

Piezas notables:

- **`post-scheduler.ts`** — reaprende los mejores día/hora desde el historial real y
  `brand_post_metrics` cada vez que corre. No hay paso de reentrenamiento aparte.
- **`brand-learning.ts` + `underperformance.ts`** — RAG sobre lo que Esteban rechazó o editó,
  **y** sobre lo que se publicó y rindió mal. Índice Vectorize separado del chatbot.
- **`brand-voice.ts`** — construye el contexto de voz desde columnas e investigaciones reales.
- **`social-publish.ts` + `oauth1.ts`** — publicación real. Credenciales **cifradas AES-GCM en
  D1** (`brand_api_settings`), no en secretos de Wrangler, para que se puedan rotar desde
  `/admin/settings` sin desplegar.
- **`short-links.ts`** — acortador propio (`kilowatto.com/r/xxxx`), 273 enlaces, 319 clics
  registrados en D1. El tracking no se cede a un tercero.

### 3 · Audio y podcast

Cubierto a fondo en `docs/medios-audio-video-spec.md`. En resumen: 52 assets, 46 narraciones +
6 conversaciones, dos feeds, cuatro altas en directorios, descargas contadas en servidor propio
y un monitor cada 6 horas.

### 4 · Presencia y reputación

- **Prensa**: 428 menciones. Google News RSS cada 6 h + barrido semanal con Brave Search.
  `press-snapshot.ts` guarda copia en R2 **y** pide archivo en web.archive.org, para que la
  mención sobreviva a que el medio la borre.
- **Briefing semanal** con el prompt propio de Esteban.
- **Larry**, el chatbot RAG: 453 vectores, embeddings bge-m3 multilingüe.

### 5 · Patrimonio personal

Biblioteca (80 libros), galería (77 fotos con captioning por IA, dedup vectorial y reglas de
privacidad), CV, trayectoria, empresas, inversiones, comida, avestruces.

## Telemetría: qué se mide hoy

| Dataset | Qué guarda | Desde |
|---|---|---|
| `kilowatto_page_views` | ruta, país, idioma, tipo, referrer, dispositivo, navegador | 2026-08-21 |
| `kilowatto_audio_events` | play/pausa/seek/fin, posición, sesión, formato | 2026-08-22 |
| `kilowatto_brand_posts` | engagement por post | — |
| `kilowatto_podcast_downloads` | descargas deduplicadas, app, país | 2026-08-23 |
| `link_clicks` (D1) | clics en enlaces cortos | — |
| GA4 | propiedad 546258249 | — |

## Las costuras: dónde el sistema no se habla consigo mismo

Esto es el hallazgo central del recorrido.

```
columnas ──✗── posts        20 piezas publicadas, 0 posts generados
audio    ──✗── posts        6 episodios, 2 directorios, 0 posts
posts    ──✗── sitio        707 de 767 posts no enlazan a kilowatto.com
posts    ──✗── telemetría   no se sabe qué post trajo qué lector
enlaces  ──✗── contenido    el acortador existe pero no se usa para piezas propias
```

| tipo de post | enlazan a kilowatto.com |
|---|---|
| `idea` | 0 / 289 |
| `news_reaction` | 0 / 160 |
| `news_reshare` | 0 / 258 |
| `investigacion_highlight` | **60 / 60** |

`brand_posts.kind` no admite `columna_highlight`, no hay `column_id`, y no existe
`columns/[id]/generate-posts.ts`. Las columnas solo entran al sistema de marca como **muestras
de voz**.

El sistema publica mucho y **casi nada de lo que publica lleva a alguien a leer**. Ese es el
problema a resolver, y es más grande que agregarle video.

## Restricciones que no cambian

1. **Nada de procesos largos en el Worker.** Remotion, ffmpeg y Chrome quedan fuera por
   arquitectura, no por cuota.
2. **Nunca `wrangler deploy` a secas** — se salta el build de Astro.
3. **Un `fetch()` al propio hostname devuelve 522.** Usar `callSelf` o el binding `SELF`.
4. **Los bindings de Workflow y de servicio no van en `wrangler.jsonc`** — rompen `astro dev`.
   Se escriben post-build en `scripts/make-scheduled-entry.mjs`.
5. **CSS con scope de Astro + `innerHTML`** no aplica ninguna regla. Usar `:global()`.
6. **LinkedIn exige reautorización manual cada 60 días, para siempre.**
7. **X cobra $0.015 por post y $0.20 si lleva URL.**
8. **Apple responde 403 a las IPs de Cloudflare.**

## Marcas futuras

Esteban quiere llevar esto a **Ignia Cloud**, **Frida Café** y **Cereza Soft**. Nada en el
sistema está preparado para varias marcas hoy: no hay `brand_id` en ninguna tabla, la voz es una
sola, las credenciales sociales son un juego único, y el chatbot indexa un solo cuerpo de
contenido. Es la decisión de arquitectura más grande que queda pendiente y conviene tomarla
**antes** de construir la fase 3, no después.

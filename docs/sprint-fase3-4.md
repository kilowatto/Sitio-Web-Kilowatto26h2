# Sprint Fases 3 y 4 — unificado con el sistema existente

> 30 decisiones tomadas con Esteban en dos rondas el 2026-08-23. Este documento es el plan de
> ejecución; el estado del sistema está en `docs/sistema-kilowatto.md` y la historia del audio en
> `docs/medios-audio-video-spec.md`.

## El principio que ordena todo

**Los clips no son un módulo de video. Son un formato más del sistema de posts que ya existe** —
misma cola, misma aprobación, mismo programador que aprende horarios, mismo `tick`. Y todo lo que
se publique debe ser gancho para leer o escuchar en el sitio.

Hoy no lo es: de 767 posts generados, 707 no enlazan a kilowatto.com, las 20 columnas publicadas
no generan ninguno, y el podcast se lanzó sin que el sistema de posts se enterara.

## Las 30 decisiones

### Alcance y marca
1. Kilowatto y Esteban Rey son **la misma voz**, no dos.
2. Solo Kilowatto por ahora, **pensado para crecer** a Ignia Cloud, Frida Café y Cereza Soft.
3. Concretamente: **nada hardcodeado**. Marca, voces, URLs y credenciales salen de configuración.
   **Sin `brand_id` todavía.**
4. YouTube **no** por ahora. X y LinkedIn, donde ya hay credenciales e historia.
5. Presupuesto: **$300-800/mes**.

### Conexiones que faltan
6. Las columnas generan posts **igual que investigaciones**: X y LinkedIn.
7. Retroactivo **solo las columnas vigentes**. Claude propone la lista, Esteban la aprueba.
8. Los tipos existentes (`idea`, `news_reaction`, `news_reshare`) enlazan a una pieza propia
   **solo cuando el vínculo sea fuerte**, medido por embeddings.
9. El audio genera post **al quedar listo el episodio**.
10. **Todo enlace propio pasa por el acortador** `kilowatto.com/r/`.
11. El acortador registra **todo**: plataforma, agente, ubicación, ASN e **IP cruda**.
    → Obliga a actualizar el aviso de privacidad.
12. **Correo cuando algo falle**, vía Cloudflare Email Sending (el token ya tiene el permiso).

### El clip
13. **Dos duraciones**: ~30 s columnas, ~75 s investigaciones.
14. **Gancho según duración**: apertura en frío en los largos, dato de golpe en los cortos.
15. **Generador de guion nuevo**, reutilizando `findInventedNumbers`.
16. Narra **Larry**, en `multilingual_v2` a estabilidad 0.4 — el modelo que Esteban aprobó, no v3.
17. **Larry aparece en cámara alternando**: pantalla completa, corte al dato, vuelta a Larry.
18. **Video e imagen conviven** y se comparan.
19. **Aprobación manual hasta aprobar los primeros N**, luego automático.
20. Si el video falla, **el post sale igual** — la cadencia no se rompe.

### Materia prima
21. **Las dos cosas**: reabrir investigaciones para clips **y** crear datos estructurados para
    columnas.
22. **Los datos van en Remotion**, nunca en video generativo: un modelo no dibuja una cifra exacta
    y legible, que es justo el trabajo de una infografía.

### Larry
23. **LoRA entrenado**, partiendo de **la portada del podcast** ya aprobada.
24. **Los dos proveedores**: ElevenLabs Flows (`creatify-aurora`) y HeyGen, comparados con datos.
25. Fase 4 **en paralelo** a la 3, no después.

### Medir y afinar
26. Métrica de éxito: **escuchas y descargas del podcast**.
27. Señal de afinamiento: **todas** — clics, descargas y engagement se complementan.
28. Variables a recorrer: **proveedor de video, perillas de lip-sync, duración**.
29. **5 clips por semana durante 6 semanas** mientras se afina; después, ritmo normal.
30. **El sistema declara ganadora** una variante con umbral y mínimo de muestra, como ya hace
    `post-scheduler.ts` con los horarios. El afinamiento **también aplica al audio existente**.

### CTA de suscripción
- Fijos en el sitio: botones de Spotify y Apple, con JSON-LD y sitemap.
- En redes: **tras un pico de descargas, o cada 12 posts como piso.**

## Orden de ejecución

Decidido: **Conexiones → CTA → Larry → video.** Los tres primeros bloques no necesitan Docker ni
Remotion, dan resultado medible por sí solos, y hacen que cuando llegue el video ya haya dónde
encajarlo y con qué compararlo.

### Bloque A · Conexiones
- A1 · `columna_highlight` + `column_id` en `brand_posts`; `columns/[id]/generate-posts.ts`.
- A2 · Enganche en el `approve.ts` de columnas.
- A3 · `audio_highlight`, disparado desde `audio-sweeper.ts`.
- A4 · Acortador para todo enlace propio, con el registro ampliado.
- A5 · Vínculo por embeddings para los tipos existentes, solo si la coincidencia es fuerte.
- A6 · Lista de columnas vigentes → aprobación de Esteban → backfill con cuentagotas.

### Bloque B · CTA y alertas
- B1 · Botones de suscripción en el sitio, con JSON-LD y sitemap.
- B2 · `subscription_cta` como tipo de post, con la regla de pico o espaciado.
- B3 · Cloudflare Email Sending para fallas del monitor, de renders y de publicación.
- B4 · Actualizar el aviso de privacidad por el registro de IP.

### Bloque C · Larry
- C1 · Turnaround desde la portada del podcast.
- C2 · LoRA en Replicate (~$2) con gate de calidad por embeddings.
- C3 · Mismo Larry por `creatify-aurora` y por HeyGen, comparados.
- C4 · Auditoría automática de logos alucinados.

### Bloque D · Video
- D1 · ⛔ **Bloqueado.** La imagen está escrita (`remotion/Dockerfile`) pero el daemon de Docker
  de Esteban no llega a Docker Hub. Diagnóstico y qué probar: `docs/pendientes-esteban.md`.
- D2 · ✅ `column_charts` (migración 0079). Los números de nueve columnas salieron de
  `generate-images.ts` a la base. La infografía y el clip leen la misma fila.
- D3 · ✅ `src/lib/clip-script.ts`.
- D4 · ✅ Clip de 57.8 s renderizado y aprobado por Esteban antes de construir orquestación.
- D5 · ✅ `remotion/src/server.ts` + `render-worker/`. Verificado: el MP4 del servidor tiene el
  mismo SHA-256 que el de `npx remotion render` — sirve de prueba del servidor y de determinismo.
- D6 · ✅ `kind = 'clip'` con `video_r2_key`. Misma cola, misma aprobación, mismo `tick`. Y de
  paso: `publishPost` **por fin adjunta el medio** — desde julio guardaba cada imagen y publicaba
  sólo texto.

### Bloque E · Afinamiento
- E1 · ✅ `experiments` / `experiment_arms` / `experiment_assignments` (migración 0077).
  Asignación **balanceada**, no aleatoria: con cinco piezas por semana una moneda justa cae 4-1
  bastante seguido.
- E2 · ✅ Clics por post (`link_clicks` → `short_links.brand_post_id`) y descargas por episodio
  (Analytics Engine → `media_assets`).
- E3 · ✅ Tres umbrales: piezas por brazo, resultado por brazo, y ventaja sobre el segundo. El
  tercero se agregó porque el primero no bastó — `audio_kind` declaró ganador con diez descargas.
- E4 · ✅ Tablero en `/admin/audio`. Tres experimentos sembrados: duración del clip, estilo del
  gancho, y conversación contra lectura completa.

## Riesgos vivos

1. **Docker no está instalado.** Bloquea todo el bloque D. Es lo único que depende de Esteban
   para arrancar.
2. **5 clips por semana sobre 23 piezas** agota el archivo en cinco semanas. Hay que decidir si se
   repiten piezas con ángulos distintos.
3. **Las perillas de lip-sync probablemente no se afinan con estadística** — la diferencia es
   sutil y la señal de clics es gruesa. Se afinan a ojo; se dejan en el sistema por completitud.
4. **IP cruda** obliga a actualizar el aviso de privacidad antes de empezar a guardarla.
5. **LinkedIn caduca cada 60 días.** Sigue sin alarma. B3 lo resuelve de paso.

---

## Bloque C — resultado: HeyGen no puede dar el Larry que Esteban quiere

Probado el 2026-08-23 durante el sprint autónomo. La detección de cara de HeyGen rechaza antes de
cobrar, así que todo esto salió gratis.

| variante | ángulo | HeyGen |
|---|---|---|
| portada del podcast (la cara elegida) | tres cuartos, hocico largo | ❌ |
| `cover_short_muzzle` | tres cuartos, hocico corto | ❌ |
| `cover_speaking` | tres cuartos, boca abierta | ❌ |
| **`cover_frontal`** | **frontal** | **✅** |
| `cover_turn20` | ~20° | ❌ |
| `cover_turn30` | ~30° | ❌ |
| `cover_turn30_nohorn` | ~30°, sin cuerno | ❌ |

**La única que pasa es la frontal.** Y Esteban la descartó explícitamente: *"Larry nunca sale de
frente. Se ve raro con el cuerno."*

El render frontal sí se completó —3.4 segundos, con la voz real de Larry desde ElevenLabs— así que
el pipeline funciona de punta a punta. El problema no es técnico: es que la única cara que HeyGen
acepta no es la cara que la marca quiere.

### La decisión que queda

**ElevenLabs `creatify-aurora` es el camino**, y no le importaría el ángulo: su documentación dice
"the image of the character to animate", no "person", y no hay detector de rostro humano de por
medio.

**Pero todo `/v1/flows/video` exige plan Pro.** Confirmado con dos llamadas: `POST /v1/assets`
responde 402 `paid_plan_required`, y al esquivarlo con `inline_base64` el propio endpoint de video
responde 402 igual. La cuenta está en Creator.

O Esteban sube a Pro, o Larry no sale en cámara. No hay tercera opción con lo probado.

El cliente de Flows ya está escrito y funciona hasta el 402 (`src/lib/elevenlabs-video.ts`,
`/api/admin/larry-video-lab`), así que el día que haya Pro es una prueba, no una construcción.

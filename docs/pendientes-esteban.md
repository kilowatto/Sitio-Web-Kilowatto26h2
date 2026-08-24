# Lo que necesita tu mano

> Generado durante el sprint autónomo del 2026-08-23. Todo lo demás avanzó sin ti.

## 1 · Autorizar el envío de correo (5 min)

Las alertas están construidas y el binding funciona, pero Cloudflare responde:

```
email sending not authorized for subdomain 'kilowatto.com'
```

**Enviar** es una habilitación distinta de Email Routing, que solo **recibe**. En
`dash.cloudflare.com` → kilowatto.com → **Email** → busca la sección de *Email Sending* o
*Outbound* y autoriza el dominio. Puede pedir registros DKIM que Cloudflare agrega solo.

Mientras tanto **no se pierde nada**: cada alerta que no se puede enviar queda encolada en KV y
se puede ver en `/api/admin/alert-test`. En cuanto autorices, empiezan a llegar a
`larry@kilowatto.com`, que ya reenvía a tu buzón.

Qué te va a avisar: comprobaciones del podcast fallando, piezas de audio que no se generaron, y
más adelante renders y publicaciones fallidas.

## 2 · Revisar la cola de posts

El sprint generó posts y **ninguno está publicado**: todos en `pending_approval`, en
`/admin/social`. Son de tres tipos nuevos y conviene mirar los primeros de cada uno antes de
aprobar en lote, porque el tono es nuevo:

- `columna_highlight` — 12 columnas del archivo, más las nuevas al aprobarse
- `audio_highlight` — anuncios de episodios
- `subscription_cta` — invitación a suscribirse al podcast

## 3 · El aviso de privacidad

El acortador `kilowatto.com/r/` guarda **IP cruda**, además de ASN, red, ciudad, agente y
resolución. Eso ya pasaba desde agosto, pero ahora que todos tus enlaces propios pasan por ahí,
el volumen y la cobertura cambian. Hay que mencionarlo en `/privacidad`.

## 4 · Backfill de columnas: 8 excluidas

En `docs/backfill-columnas.md` está la lista de las 8 que dejé fuera por estar atadas a un
momento o a una predicción sobre 2026 que ya va a la mitad. Si alguna te parece que sigue
vigente, dime y la genero.

## 5 · Decisión: ¿Larry en cámara?

HeyGen **solo** acepta a Larry de frente, y dijiste que de frente no. Probé siete variantes; la
tabla está en `docs/sprint-fase3-4.md`. No es un problema técnico —el render frontal salió bien,
3.4 s con tu voz— es que la única cara que su detector acepta no es la que quieres.

ElevenLabs `creatify-aurora` sí anima personajes sin detector de rostro humano, pero **todo su
endpoint de video exige plan Pro** y estás en Creator. El código ya está escrito y llega hasta el
402, así que el día que subas es una prueba de cinco minutos, no una construcción.

**O subes a Pro, o Larry no sale en cámara.** Los clips sin él funcionan igual; es una decisión de
marca, no de ingeniería.

## 6 · Docker quedó listo

Instalaste Docker 29.7.2, así que el bloque D no está bloqueado.

## Docker en tu Mac no llega a Docker Hub (bloquea el render en producción)

Todo el servicio de render está escrito y verificado localmente: `remotion/Dockerfile`,
`remotion/src/server.ts` (el servidor HTTP que corre dentro del contenedor) y `render-worker/`
(el Worker que lo maneja). El servidor produjo un MP4 **byte por byte idéntico** al que genera
`npx remotion render` — mismo SHA-256 — así que el código está bien.

Lo único que falta es construir y subir la imagen, y ahí se atora:

```
#2 [internal] load metadata for docker.io/library/node:24-bookworm-slim
#2 ERROR: DeadlineExceeded: context deadline exceeded
```

El diagnóstico: desde la terminal, `curl https://registry-1.docker.io/v2/` responde en 0.3 s. El
**daemon** de Docker no. Docker Desktop manda todo su tráfico por su proxy interno
(`http.docker.internal:3128`) y esa ruta no está saliendo. No hay proxy de sistema ni variable de
entorno que lo explique, y reiniciar Docker Desktop no lo arregló.

Qué probar, en orden:

1. Docker Desktop → Settings → Resources → Network: cambia el modo a **"Manual"** con DNS
   `8.8.8.8`, o activa/desactiva "Use kernel networking for UDP".
2. Settings → Resources → Proxies: deja **"Use system proxy settings"** apagado y sin proxy manual.
3. Si estás en una VPN, apágala y prueba `docker pull node:24-bookworm-slim`.
4. Como último recurso, Troubleshoot → **Reset to factory defaults**.

Cuando `docker pull node:24-bookworm-slim` funcione, avísame o corre tú:

```
cd render-worker
npx wrangler secret put RENDER_SECRET     # el mismo valor que en el Worker del sitio
npx wrangler deploy                        # construye y sube la imagen sola
```


## El primer clip ya está en la cola esperándote

Posts **889** (X) y **890** (LinkedIn) en `/admin/social`, los dos en `pending_approval` con el
video de 57.8 s adjunto. Ahí puedes verlo antes de decidir: la tarjeta ahora reproduce el clip.

Dos cosas que vas a notar y que no son fallas del video:

- **El texto que lo acompaña es flojo.** "Descubre qué hay detrás de las promesas de las VPN" es
  exactamente el tipo de frase que pediste evitar. El video ya cuenta el dato; el texto debería
  dar la razón para ir a leer. Si rechazas los dos con un comentario, el sistema aprende de eso.
- **El de LinkedIn quedó programado para el 9 de diciembre.** No es un error de fecha: hay 247
  posts en cola y LinkedIn admite uno al día, así que el calendario ya está lleno hasta allá. Si
  quieres que los clips se salten la fila, dímelo y les pongo prioridad.

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

## El render en producción ya existe

Se resolvió solo: el `docker pull` que llevaba horas agotando el tiempo pasó sin cambiarle nada.
La imagen se construyó, se subió, y `kilowatto-render` está desplegado con su contenedor.

Verificado antes de subirla: el contenedor renderiza el clip de VPN a h264 1080×1920 con AAC en
57.81 s, y dos corridas de los mismos props dentro del contenedor salieron idénticas byte por
byte. Contra el render de macOS los bytes difieren (3.22 MB contra 3.29 MB) — otra plataforma,
otra compilación de libx264. El determinismo se sostiene dentro de una misma plataforma, que es
lo que de verdad necesita un re-render.

El barrido de clips corre cada seis horas, hace **uno** por corrida y respeta el límite de cinco
por semana que pediste. Nada se publica: todo cae en `pending_approval`.

Si alguna vez vuelve a atorarse la construcción en "load metadata", el primer interruptor que
apagaría es **Settings → General → "Use containerd for pulling and storing images"**, que lo
tienes encendido.

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

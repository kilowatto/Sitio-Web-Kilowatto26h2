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

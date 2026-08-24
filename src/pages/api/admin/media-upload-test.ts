import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { readMedia, uploadMediaToX, uploadMediaToLinkedIn } from "../../../lib/social-media";
import { getSetting } from "../../../lib/social-publish";

export const prerender = false;

// Ejercita la subida de medios contra las APIs reales SIN publicar nada.
//
// Subir un medio y publicar un post son dos operaciones distintas: hasta que un media_id se
// adjunta a un tweet, o un urn de video a un post, no existe nada visible para nadie. Eso
// permite probar la parte arriesgada -- la subida por trozos de X, las partes con ETag de
// LinkedIn -- sin que salga nada a la calle.
//
// Existe porque el primer clip aprobado se publica solo, en su horario, por un camino que hasta
// hoy nunca había hablado con las APIs de verdad. Descubrir ahí que la subida falla significa un
// post fallido en la cola; descubrirlo aquí no significa nada.
export const POST: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });

  const key = url.searchParams.get("key");
  const platform = url.searchParams.get("platform");
  if (!key || (platform !== "x" && platform !== "linkedin")) {
    return Response.json({ error: "se requieren key y platform (x|linkedin)" }, { status: 400 });
  }

  const media = await readMedia(env, key);
  if (!media) return Response.json({ error: `no se pudo leer ${key} de R2` }, { status: 404 });

  const started = Date.now();
  if (platform === "x") {
    const [apiKey, apiKeySecret, accessToken, accessTokenSecret] = await Promise.all([
      getSetting(env, "X_API_KEY"),
      getSetting(env, "X_API_KEY_SECRET"),
      getSetting(env, "X_ACCESS_TOKEN"),
      getSetting(env, "X_ACCESS_TOKEN_SECRET"),
    ]);
    if (!apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) {
      return Response.json({ error: "faltan credenciales OAuth 1.0a de X" }, { status: 400 });
    }
    const res = await uploadMediaToX(
      { apiKey, apiKeySecret, accessToken, accessTokenSecret },
      media.bytes,
      media.contentType
    );
    return Response.json({
      platform,
      bytes: media.bytes.byteLength,
      contentType: media.contentType,
      mediaId: res?.id ?? null,
      ok: !!res,
      seconds: Math.round((Date.now() - started) / 100) / 10,
    });
  }

  const [accessToken, personUrn] = await Promise.all([
    getSetting(env, "LINKEDIN_ACCESS_TOKEN"),
    getSetting(env, "LINKEDIN_PERSON_URN"),
  ]);
  if (!accessToken || !personUrn) {
    return Response.json({ error: "faltan LINKEDIN_ACCESS_TOKEN/LINKEDIN_PERSON_URN" }, { status: 400 });
  }
  const res = await uploadMediaToLinkedIn(accessToken, personUrn, media.bytes, media.contentType);
  return Response.json({
    platform,
    bytes: media.bytes.byteLength,
    contentType: media.contentType,
    urn: res?.id ?? null,
    ok: !!res,
    seconds: Math.round((Date.now() - started) / 100) / 10,
  });
};

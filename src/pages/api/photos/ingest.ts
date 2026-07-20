import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { captionAndFlag } from "../../../lib/photo-caption";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json<{
    r2_key: string;
    album?: string;
    taken_date?: string;
    taken_city?: string;
  }>();

  if (!body?.r2_key) {
    return new Response(JSON.stringify({ error: "missing r2_key" }), { status: 400 });
  }

  const object = await env.MEDIA.get(body.r2_key);
  if (!object) {
    return new Response(JSON.stringify({ error: "object not found in R2" }), { status: 404 });
  }

  const bytes = new Uint8Array(await object.arrayBuffer());
  const { caption, minorFlag } = await captionAndFlag(bytes);

  await env.DB.prepare(
    `INSERT INTO photos (r2_key, ai_caption, album, taken_date, taken_city, minor_flag, approval_status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`
  )
    .bind(body.r2_key, caption, body.album ?? null, body.taken_date ?? null, body.taken_city ?? null, minorFlag)
    .run();

  return new Response(JSON.stringify({ ok: true, ai_caption: caption, minor_flag: minorFlag }), {
    headers: { "content-type": "application/json" },
  });
};

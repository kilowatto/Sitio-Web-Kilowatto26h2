import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  if (new URL(request.url).searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  await env.DB.prepare("UPDATE press_mentions SET status = 'published', approved_at = datetime('now') WHERE id = ?")
    .bind(params.id)
    .run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

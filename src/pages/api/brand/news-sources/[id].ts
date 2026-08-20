import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ trusted?: boolean }>();
  if (typeof body.trusted === "boolean") {
    await env.DB.prepare("UPDATE news_sources SET trusted = ? WHERE id = ?").bind(body.trusted ? 1 : 0, params.id).run();
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  await env.DB.prepare("DELETE FROM news_sources WHERE id = ?").bind(params.id).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

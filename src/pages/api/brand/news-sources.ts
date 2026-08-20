import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const { results } = await env.DB.prepare("SELECT * FROM news_sources ORDER BY trusted DESC, name").all();
  return new Response(JSON.stringify({ sources: results ?? [] }), { headers: { "content-type": "application/json" } });
};

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ name: string; domain?: string }>();
  if (!body?.name) return new Response(JSON.stringify({ error: "falta name" }), { status: 400 });

  await env.DB.prepare("INSERT INTO news_sources (name, domain) VALUES (?, ?)").bind(body.name, body.domain ?? null).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

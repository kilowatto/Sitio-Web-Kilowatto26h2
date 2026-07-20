import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const { results } = await env.DB.prepare("SELECT * FROM brand_topics ORDER BY sort_order").all();
  return new Response(JSON.stringify({ topics: results ?? [] }), { headers: { "content-type": "application/json" } });
};

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ label: string; description?: string }>();
  if (!body?.label) return new Response(JSON.stringify({ error: "falta label" }), { status: 400 });

  const maxSort = await env.DB.prepare("SELECT MAX(sort_order) AS n FROM brand_topics").first<any>();
  await env.DB.prepare("INSERT INTO brand_topics (label, description, sort_order) VALUES (?, ?, ?)")
    .bind(body.label, body.description ?? null, (maxSort?.n ?? 0) + 1)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

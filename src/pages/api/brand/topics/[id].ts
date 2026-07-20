import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ active?: boolean; label?: string; description?: string }>();

  if (typeof body.active === "boolean") {
    await env.DB.prepare("UPDATE brand_topics SET active = ? WHERE id = ?").bind(body.active ? 1 : 0, params.id).run();
  }
  if (body.label || body.description) {
    await env.DB.prepare("UPDATE brand_topics SET label = COALESCE(?, label), description = COALESCE(?, description) WHERE id = ?")
      .bind(body.label ?? null, body.description ?? null, params.id)
      .run();
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

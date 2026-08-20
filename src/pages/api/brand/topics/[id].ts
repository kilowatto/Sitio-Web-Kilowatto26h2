import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{
    active?: boolean;
    label?: string;
    description?: string;
    imageStyle?: "illustration" | "infographic" | "real_photo" | "photorealistic";
    staleFlag?: boolean;
  }>();

  if (typeof body.active === "boolean") {
    await env.DB.prepare("UPDATE brand_topics SET active = ? WHERE id = ?").bind(body.active ? 1 : 0, params.id).run();
  }
  if (body.label || body.description) {
    await env.DB.prepare("UPDATE brand_topics SET label = COALESCE(?, label), description = COALESCE(?, description) WHERE id = ?")
      .bind(body.label ?? null, body.description ?? null, params.id)
      .run();
  }
  if (body.imageStyle) {
    await env.DB.prepare("UPDATE brand_topics SET image_style = ? WHERE id = ?").bind(body.imageStyle, params.id).run();
  }
  // "Dismiss" from the stale-review summary — a human reviewed the suggestion and decided the
  // topic is actually fine, so clear the flag/note without touching label/description.
  if (typeof body.staleFlag === "boolean") {
    await env.DB.prepare("UPDATE brand_topics SET stale_flag = ?, review_note = CASE WHEN ? THEN review_note ELSE '' END WHERE id = ?")
      .bind(body.staleFlag ? 1 : 0, body.staleFlag ? 1 : 0, params.id)
      .run();
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

// Real delete when nothing references this topic. If old brand_posts still point at it
// (FK constraint, enforced on this DB), deleting isn't safe — falls back to deactivating
// instead of failing outright, since that's the actual intent ("no lo quiero ver ni usar más").
export const DELETE: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    await env.DB.prepare("DELETE FROM brand_topics WHERE id = ?").bind(params.id).run();
    return new Response(JSON.stringify({ ok: true, deleted: true }), { headers: { "content-type": "application/json" } });
  } catch {
    await env.DB.prepare("UPDATE brand_topics SET active = 0 WHERE id = ?").bind(params.id).run();
    return new Response(JSON.stringify({ ok: true, deleted: false, reason: "referenced_by_posts" }), {
      headers: { "content-type": "application/json" },
    });
  }
};

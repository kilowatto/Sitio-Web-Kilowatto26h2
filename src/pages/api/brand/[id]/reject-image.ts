import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { proposeImage } from "../../../../lib/brand-image";

export const prerender = false;

// Rejects only the image, not the whole post — keeps the approved/edited text intact and
// searches for a different picture (real gallery match first, AI-generated fallback),
// excluding whatever was just rejected so it doesn't just come back immediately.
export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const post = await env.DB.prepare(
    `SELECT bp.content, bp.image_r2_key, bp.topic_id, bt.label AS topic_label
     FROM brand_posts bp LEFT JOIN brand_topics bt ON bt.id = bp.topic_id
     WHERE bp.id = ?`
  )
    .bind(params.id)
    .first<any>();
  if (!post) return new Response("not found", { status: 404 });

  const newKey = await proposeImage(post.topic_label ?? "", post.content, post.image_r2_key ?? undefined);

  await env.DB.prepare("UPDATE brand_posts SET image_r2_key = ? WHERE id = ?").bind(newKey, params.id).run();

  return new Response(JSON.stringify({ ok: true, imageKey: newKey }), {
    headers: { "content-type": "application/json" },
  });
};

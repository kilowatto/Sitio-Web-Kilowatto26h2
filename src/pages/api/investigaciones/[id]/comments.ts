import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { hashIp, isBanned, recentCommentCount, isRateLimited, flagSpam, sanitizeAuthorName, validateBody } from "../../../../lib/comment-moderation";

export const prerender = false;

// Mirrors src/pages/api/columns/[id]/comments.ts exactly -- same moderation
// pipeline, just the FK column swapped.
export const POST: APIRoute = async ({ params, request }) => {
  const investigacionId = Number(params.id);
  if (!investigacionId) return new Response(JSON.stringify({ ok: false, error: "investigación inválida" }), { status: 400 });

  const body = await request.json<{ author_name?: string; body?: string; website?: string }>().catch(() => ({}) as any);

  if (body.website && body.website.trim() !== "") {
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }

  const validated = validateBody(body.body);
  if (!validated.ok) {
    return new Response(JSON.stringify({ ok: false, error: validated.error }), { status: 400 });
  }

  const investigacion = await env.DB.prepare("SELECT id FROM investigaciones WHERE id = ? AND status = 'published'")
    .bind(investigacionId)
    .first();
  if (!investigacion) return new Response(JSON.stringify({ ok: false, error: "investigación no encontrada" }), { status: 404 });

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ipHash = await hashIp(env, ip);

  if (await isBanned(env, ipHash)) {
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }

  const recentCount = await recentCommentCount(env, ipHash);
  if (isRateLimited(recentCount)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Demasiados comentarios en poco tiempo. Intenta de nuevo más tarde." }),
      { status: 429 }
    );
  }

  const authorName = sanitizeAuthorName(body.author_name);
  const flagReason = flagSpam(validated.body);
  const userAgent = request.headers.get("user-agent") ?? null;

  await env.DB.prepare(
    `INSERT INTO comments (investigacion_id, author_name, body, status, flagged_reason, ip_hash, user_agent)
     VALUES (?, ?, ?, 'pending', ?, ?, ?)`
  )
    .bind(investigacionId, authorName, validated.body, flagReason, ipHash, userAgent)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

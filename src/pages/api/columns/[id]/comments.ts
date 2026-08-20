import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { hashIp, isBanned, recentCommentCount, isRateLimited, flagSpam, sanitizeAuthorName, validateBody } from "../../../../lib/comment-moderation";

export const prerender = false;

// Public — no admin token, no account. Every comment lands as 'pending' regardless of these
// checks; they only decide whether it's silently dropped (banned ip) or flagged for Esteban's
// attention (spam heuristic), never whether it publishes — only he does that, in
// /admin/comentarios.
export const POST: APIRoute = async ({ params, request }) => {
  const columnId = Number(params.id);
  if (!columnId) return new Response(JSON.stringify({ ok: false, error: "columna inválida" }), { status: 400 });

  const body = await request.json<{ author_name?: string; body?: string; website?: string }>().catch(() => ({}) as any);

  // Honeypot: a field named to look attractive to bots ("website") that's hidden from real
  // users via CSS in the form. Any value here means a bot filled every field it could find.
  if (body.website && body.website.trim() !== "") {
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }

  const validated = validateBody(body.body);
  if (!validated.ok) {
    return new Response(JSON.stringify({ ok: false, error: validated.error }), { status: 400 });
  }

  const column = await env.DB.prepare("SELECT id FROM columns WHERE id = ? AND status = 'published'").bind(columnId).first();
  if (!column) return new Response(JSON.stringify({ ok: false, error: "columna no encontrada" }), { status: 404 });

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ipHash = await hashIp(env, ip);

  if (await isBanned(env, ipHash)) {
    // Looks identical to a normal success response — no signal to the sender that they're
    // blocked, which would just invite retrying from a different IP.
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
    `INSERT INTO comments (column_id, author_name, body, status, flagged_reason, ip_hash, user_agent)
     VALUES (?, ?, ?, 'pending', ?, ?, ?)`
  )
    .bind(columnId, authorName, validated.body, flagReason, ipHash, userAgent)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

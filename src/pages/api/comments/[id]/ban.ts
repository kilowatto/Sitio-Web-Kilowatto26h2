import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Bans the IP behind a given comment — future submissions from that IP are silently dropped
// (see comments.ts) — and immediately rejects every other pending comment already sitting in
// the queue from that same IP, so one ban click clears a spam burst instead of leaving the
// rest to reject one by one.
export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ reason?: string }>().catch(() => ({}) as any);

  const comment = await env.DB.prepare("SELECT ip_hash FROM comments WHERE id = ?").bind(params.id).first<any>();
  if (!comment) return new Response(JSON.stringify({ ok: false, error: "comentario no encontrado" }), { status: 404 });

  await env.DB.prepare(
    `INSERT INTO comment_bans (ip_hash, reason) VALUES (?, ?)
     ON CONFLICT(ip_hash) DO UPDATE SET reason = excluded.reason`
  )
    .bind(comment.ip_hash, body.reason || null)
    .run();

  await env.DB.prepare(
    `UPDATE comments SET status = 'rejected', rejection_reason = COALESCE(rejection_reason, 'ip baneada')
     WHERE ip_hash = ? AND status = 'pending'`
  )
    .bind(comment.ip_hash)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

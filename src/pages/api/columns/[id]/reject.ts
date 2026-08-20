import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { recordFeedback } from "../../../../lib/brand-learning";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const id = params.id;
  const body = await request.json<{ reason?: string }>().catch(() => ({}) as any);

  const current = await env.DB.prepare("SELECT title, topic_id FROM columns WHERE id = ?").bind(id).first<any>();
  if (!current) return new Response("not found", { status: 404 });

  await env.DB.prepare(`UPDATE columns SET status = 'rejected', rejection_reason = COALESCE(?, rejection_reason) WHERE id = ?`)
    .bind(body?.reason || null, id)
    .run();

  if (body?.reason && current.topic_id) {
    await recordFeedback({
      type: "rejection",
      text: `Columna rechazada: "${current.title}" — razón: ${body.reason}`,
      topicId: current.topic_id,
      platform: "columna",
    });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

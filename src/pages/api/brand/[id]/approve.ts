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
  const body = await request.json<{ content?: string }>().catch(() => ({}) as any);

  const current = await env.DB.prepare("SELECT content, original_content, topic_id, platform FROM brand_posts WHERE id = ?")
    .bind(id)
    .first<any>();
  if (!current) return new Response("not found", { status: 404 });

  const wasEdited = !!body?.content && body.content !== current.content;

  if (wasEdited) {
    await env.DB.prepare(
      `UPDATE brand_posts SET original_content = ?, content = ?, status = 'approved', approved_at = datetime('now') WHERE id = ?`
    )
      .bind(current.original_content ?? current.content, body.content, id)
      .run();
  } else {
    await env.DB.prepare(`UPDATE brand_posts SET status = 'approved', approved_at = datetime('now') WHERE id = ?`)
      .bind(id)
      .run();
  }

  if (wasEdited) {
    await recordFeedback({
      type: "edit",
      text: `Original: "${current.content.slice(0, 120)}" → Esteban lo cambió a: "${body.content.slice(0, 120)}"`,
      topicId: current.topic_id,
      platform: current.platform,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

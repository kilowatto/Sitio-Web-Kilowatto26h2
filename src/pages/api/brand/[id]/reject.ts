import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { recordFeedback } from "../../../../lib/brand-learning";
import { recordTrustReset } from "../../../../lib/news-reaction-trust";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json<{ reason?: string }>().catch(() => ({}) as any);
  const reason = body?.reason || null;

  const post = await env.DB.prepare("SELECT content, topic_id, platform, kind FROM brand_posts WHERE id = ?")
    .bind(params.id)
    .first<any>();

  // Reason is genuinely optional (Esteban's call — forcing it every time kills the habit
  // of using it at all) — store NULL when absent so it's excluded from the vector feedback
  // store as "no signal" instead of embedding a meaningless placeholder.
  await env.DB.prepare(`UPDATE brand_posts SET status = 'rejected', rejection_reason = ? WHERE id = ?`)
    .bind(reason, params.id)
    .run();

  if (reason && post) {
    await recordFeedback({
      type: "rejection",
      text: `Post: "${post.content.slice(0, 150)}" — Rechazado porque: ${reason}`,
      topicId: post.topic_id,
      platform: post.platform,
    });
  }

  if (post?.kind === "news_reaction") {
    await recordTrustReset(post.platform);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

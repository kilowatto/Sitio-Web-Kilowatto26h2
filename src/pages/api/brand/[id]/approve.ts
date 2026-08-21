import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { recordFeedback } from "../../../../lib/brand-learning";
import { recordCleanApproval, recordTrustReset } from "../../../../lib/news-reaction-trust";
import { assignSmartSchedule } from "../../../../lib/post-scheduler";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const id = params.id;
  const body = await request.json<{ content?: string; hashtags?: string }>().catch(() => ({}) as any);

  const current = await env.DB.prepare("SELECT content, original_content, topic_id, platform, kind, scheduled_for FROM brand_posts WHERE id = ?")
    .bind(id)
    .first<any>();
  if (!current) return new Response("not found", { status: 404 });

  const wasEdited = !!body?.content && body.content !== current.content;

  // Every approval gets a real scheduled_for, picked from whichever day-of-week/hour has
  // historically performed best for this platform (falls back to sane defaults until
  // there's enough posted history to trust) -- previously NULL meant "post whenever the
  // next cron tick has room," a blind FIFO queue with no regard for timing.
  const scheduledFor = current.scheduled_for ?? (await assignSmartSchedule(current.platform));

  if (wasEdited) {
    await env.DB.prepare(
      `UPDATE brand_posts SET original_content = ?, content = ?, hashtags = ?, status = 'approved', approved_at = datetime('now'), scheduled_for = ? WHERE id = ?`
    )
      .bind(current.original_content ?? current.content, body.content, body.hashtags ?? null, scheduledFor, id)
      .run();
  } else {
    await env.DB.prepare(`UPDATE brand_posts SET hashtags = ?, status = 'approved', approved_at = datetime('now'), scheduled_for = ? WHERE id = ?`)
      .bind(body.hashtags ?? null, scheduledFor, id)
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

  if (current.kind === "news_reaction") {
    if (wasEdited) await recordTrustReset(current.platform);
    else await recordCleanApproval(current.platform);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

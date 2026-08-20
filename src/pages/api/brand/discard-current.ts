import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { recordFeedback } from "../../../lib/brand-learning";

export const prerender = false;

// Backs the "Generar nuevos" button in /admin/social: wipes drafts still waiting on a
// decision before a fresh batch is generated. Deliberately does NOT touch 'approved' posts
// — those are already queued in the publishing pipeline (Esteban's call: approved posts
// build up a pipeline and must survive a "generate new" click, only undecided drafts get
// discarded). Reuses the existing 'rejected' status rather than adding a new enum value —
// same table SQLite CHECK constraint issue as brand_posts.kind earlier this project.
export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const { results } = await env.DB.prepare(
    `SELECT id, content, topic_id, platform FROM brand_posts WHERE status = 'pending_approval'`
  ).all<any>();
  const rows = results ?? [];

  for (const r of rows) {
    await env.DB.prepare(
      `UPDATE brand_posts SET status = 'rejected', rejection_reason = 'Descartado en bloque para generar nuevos' WHERE id = ?`
    )
      .bind(r.id)
      .run();

    await recordFeedback({
      type: "rejection",
      text: `Post: "${r.content.slice(0, 150)}" — Descartado en bloque sin publicarse (reemplazado por una nueva generación).`,
      topicId: r.topic_id,
      platform: r.platform,
    });
  }

  return new Response(JSON.stringify({ ok: true, discarded: rows.length }), {
    headers: { "content-type": "application/json" },
  });
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Mirrors columns/[id]/approve.ts's shape -- publish, allow last-minute edits
// to title/summary/body before it goes live. No brand-learning tie-in yet
// (that system is topic_id-scoped for brand_posts/columns; investigaciones
// use free-text topics, per the 2026-08-21 decision).
export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const id = params.id;
  const body = await request.json<{ title?: string; subtitle?: string; summary?: string; body_html?: string }>().catch(
    () => ({}) as any
  );

  const current = await env.DB.prepare("SELECT title, subtitle, summary, body_html FROM investigaciones WHERE id = ?")
    .bind(id)
    .first<any>();
  if (!current) return new Response("not found", { status: 404 });

  const newTitle = body?.title ?? current.title;
  const newSubtitle = body?.subtitle ?? current.subtitle;
  const newSummary = body?.summary ?? current.summary;
  const newBody = body?.body_html ?? current.body_html;

  await env.DB.prepare(
    `UPDATE investigaciones SET title = ?, subtitle = ?, summary = ?, body_html = ?, status = 'published', published_at = datetime('now') WHERE id = ?`
  )
    .bind(newTitle, newSubtitle, newSummary, newBody, id)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

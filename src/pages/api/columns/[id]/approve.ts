import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runGenerateColumnPosts } from "./generate-posts";
import { recordFeedback } from "../../../../lib/brand-learning";
import { postColumnCarouselToLinkedIn } from "../../../../lib/linkedin-carousel";
import { runReindex } from "../../reindex";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const id = params.id;
  const body = await request.json<{ title?: string; subtitle?: string; body_html?: string }>().catch(() => ({}) as any);

  const current = await env.DB.prepare(
    "SELECT slug, title, subtitle, body_html, topic_id, cover_r2_key, og_r2_key FROM columns WHERE id = ?"
  )
    .bind(id)
    .first<any>();
  if (!current) return new Response("not found", { status: 404 });

  const newTitle = body?.title ?? current.title;
  const newSubtitle = body?.subtitle ?? current.subtitle;
  const newBody = body?.body_html ?? current.body_html;
  const wasEdited = newTitle !== current.title || newSubtitle !== current.subtitle || newBody !== current.body_html;

  await env.DB.prepare(
    `UPDATE columns SET title = ?, subtitle = ?, body_html = ?, status = 'published', published_at = date('now') WHERE id = ?`
  )
    .bind(newTitle, newSubtitle, newBody, id)
    .run();

  if (wasEdited && current.topic_id) {
    await recordFeedback({
      type: "edit",
      text: `Columna original: "${current.title}" → Esteban la editó a: "${newTitle}"`,
      topicId: current.topic_id,
      platform: "columna",
    });
  }

  // Fire-and-record the LinkedIn carousel post — never let a LinkedIn failure (or missing
  // credentials) block the approve flow itself, just log what happened for /admin/settings
  // or a future admin view to surface.
  const coverKey = current.og_r2_key || current.cover_r2_key;
  const coverUrl = coverKey ? `https://kilowatto.com/media/${coverKey}` : null;
  const carousel = await postColumnCarouselToLinkedIn(
    env,
    { slug: current.slug, title: newTitle, subtitle: newSubtitle, body_html: newBody },
    coverUrl
  ).catch((err) => ({ ok: false, error: String(err?.message ?? err) }));
  await env.DB.prepare("UPDATE columns SET linkedin_post_url = ?, linkedin_post_error = ? WHERE id = ?")
    .bind(carousel.ok ? (carousel.externalUrl ?? null) : null, carousel.ok ? null : (carousel.error ?? null), id)
    .run();

  // Best-effort: Larry (the site's chatbot) never learned about newly-published content
  // automatically anywhere on the site until 2026-08-21 -- someone had to remember to hit
  // /api/reindex by hand. Fixed sitewide (this also covers investigaciones, see their
  // approve.ts).
  let reindexed = 0;
  let reindexError: string | null = null;
  try {
    const reindexResult = await runReindex();
    reindexed = reindexResult.indexed;
  } catch (err: any) {
    reindexError = err?.message ?? "unknown error reindexing";
  }

  // Translate into the 11 non-canonical locales in the background.
  //
  // Investigaciones have done this on approve for a while; columns never did, so any column
  // published between manual runs of /api/translate silently stayed monolingual. Found
  // 2026-08-22 when the audio backfill hit a column with no English body three weeks after it
  // was published — nothing else had surfaced it.
  //
  // Fire-and-forget behind a binding check: the binding only exists in the real Worker, not in
  // `astro dev`, and a translation failure must never block a publish that already succeeded.
  // Announce the column. Until 2026-08-23 this never happened: brand_posts had no
  // columna_highlight kind and no column_id, so 20 published columns generated zero posts while
  // investigaciones generated 60. Inline rather than fire-and-forget because it is four LLM
  // calls and four images -- seconds, not minutes -- and because a column that silently fails to
  // announce itself is exactly the failure mode this is fixing.
  let posts: string | null = null;
  try {
    const generated = await runGenerateColumnPosts(Number(id), 4);
    posts = "error" in generated ? `falló: ${generated.error}` : `${generated.count} posts en cola`;
  } catch (err: any) {
    posts = `falló: ${err?.message ?? "error desconocido"}`;
  }

  let translation: string | null = null;
  try {
    if ((env as any).TRANSLATE_COLUMN_WORKFLOW) {
      await (env as any).TRANSLATE_COLUMN_WORKFLOW.create({ params: { columnId: Number(id) } });
      translation = "workflow lanzado";
    } else {
      translation = "binding ausente (dev)";
    }
  } catch (err: any) {
    translation = `falló al lanzar: ${err?.message ?? "error desconocido"}`;
  }

  return new Response(JSON.stringify({ ok: true, linkedin: carousel, reindexed, reindexError, translation, posts }), {
    headers: { "content-type": "application/json" },
  });
};

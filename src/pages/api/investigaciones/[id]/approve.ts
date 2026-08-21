import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runGeneratePosts } from "./generate-posts";
import { ensureInvestigacionImages } from "../../../../lib/investigacion-image";

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

  // Best-effort: no published piece should ever go live with no cover and no
  // chart illustrations -- the 2026-08-21 test piece did exactly that because
  // the ad-hoc assembly process never called the image endpoints at all.
  // ensureInvestigacionImages() only fills gaps (never touches an image that
  // already exists), so this is safe to run on every approve regardless of how
  // the piece was produced.
  let coverGenerated = false;
  let chartsImaged = 0;
  let imagesError: string | null = null;
  try {
    const imagesResult = await ensureInvestigacionImages(env, Number(id));
    coverGenerated = imagesResult.coverGenerated;
    chartsImaged = imagesResult.chartsGenerated;
  } catch (err: any) {
    imagesError = err?.message ?? "unknown error generating images";
  }

  // Best-effort: a batch of 24-48 scheduled social posts always accompanies a
  // publish per the 2026-08-21 decision, but a generation hiccup must never
  // undo/block the publish itself -- Esteban can always re-trigger this
  // endpoint by hand from /admin/a-fondo if it fails or comes up short.
  let postsGenerated: number | null = null;
  let postsError: string | null = null;
  try {
    const postsResult = await runGeneratePosts(Number(id));
    if ("error" in postsResult) postsError = postsResult.error;
    else postsGenerated = postsResult.count;
  } catch (err: any) {
    postsError = err?.message ?? "unknown error generating posts";
  }

  return new Response(
    JSON.stringify({ ok: true, coverGenerated, chartsImaged, imagesError, postsGenerated, postsError }),
    { headers: { "content-type": "application/json" } }
  );
};

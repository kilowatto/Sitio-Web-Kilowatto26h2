import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runGeneratePosts } from "./generate-posts";
import { runGenerateBodyImages } from "./generate-body-images";
import { runGenerateFaqs } from "../../../../lib/investigacion-faq";
import { ensureInvestigacionImages } from "../../../../lib/investigacion-image";
import { runReindex } from "../../reindex";

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

  // Best-effort: editorial images spread through the body itself (~every 500 words, text
  // wrapping around them) -- 2026-08-21 decision, applies going forward only. Idempotent
  // (checks its own marker class), so safe on every approve regardless of how the piece was
  // produced. Runs BEFORE translation below so every locale's stored copy already includes
  // the same inline-image figures (they're opaque to the translator either way, but a locale
  // translated before this ran would need a second pass to pick them up).
  let bodyImagesInserted = 0;
  let bodyImagesError: string | null = null;
  try {
    const bodyImagesResult = await runGenerateBodyImages(Number(id));
    if (bodyImagesResult.error) bodyImagesError = bodyImagesResult.error;
    else bodyImagesInserted = bodyImagesResult.inserted;
  } catch (err: any) {
    bodyImagesError = err?.message ?? "unknown error generating body images";
  }

  // Best-effort: every published piece gets an AI-generated FAQ set (grounded in its own
  // body/sources, see src/lib/investigacion-faq.ts) -- powers both a visible on-page FAQ
  // section and FAQPage JSON-LD for GEO/AI-Overview citability, per the 2026-08-21 decision.
  // Runs BEFORE translation below so the workflow's per-locale step also translates the FAQs.
  let faqsGenerated: number | null = null;
  let faqsError: string | null = null;
  try {
    const faqsResult = await runGenerateFaqs(Number(id));
    if (faqsResult.error) faqsError = faqsResult.error;
    else faqsGenerated = faqsResult.count ?? 0;
  } catch (err: any) {
    faqsError = err?.message ?? "unknown error generating FAQs";
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

  // Best-effort: Larry (the site's chatbot) never learned about newly-published content
  // automatically anywhere on the site until 2026-08-21 -- someone had to remember to hit
  // /api/reindex by hand. Fixed sitewide (this also covers columns, see their approve.ts).
  let reindexed = 0;
  let reindexError: string | null = null;
  try {
    const reindexResult = await runReindex();
    reindexed = reindexResult.indexed;
  } catch (err: any) {
    reindexError = err?.message ?? "unknown error reindexing";
  }

  // Fire-and-forget: translating a 6000-12000 word piece (plus its charts) into all 11
  // non-canonical locales takes too long to run inline here -- a Cloudflare Workflow does it
  // in the background, one durably-retryable step per locale (see
  // scripts/translate-investigacion-workflow.mjs). Binding is only present in the real
  // deployed Worker (not local `astro dev`), hence the guard.
  let translationStarted = false;
  let translationError: string | null = null;
  try {
    if (env.TRANSLATE_INVESTIGACION_WORKFLOW) {
      await env.TRANSLATE_INVESTIGACION_WORKFLOW.create({ params: { investigacionId: Number(id) } });
      translationStarted = true;
    }
  } catch (err: any) {
    translationError = err?.message ?? "unknown error starting translation workflow";
  }

  return new Response(
    JSON.stringify({
      ok: true,
      coverGenerated,
      chartsImaged,
      imagesError,
      bodyImagesInserted,
      bodyImagesError,
      faqsGenerated,
      faqsError,
      postsGenerated,
      postsError,
      reindexed,
      reindexError,
      translationStarted,
      translationError,
    }),
    { headers: { "content-type": "application/json" } }
  );
};

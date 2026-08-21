import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { generateInvestigacionImage } from "../../../../lib/investigacion-image";

export const prerender = false;

// Editorial images spread through the article body itself (not just cover/chart
// illustrations) -- Esteban, 2026-08-21: "que se vea editorialmente bien... genere
// algo asi como por cada 500 palabras una imagen". Only applied going forward, not
// retroactively to already-published pieces (his call, same conversation). Idempotent:
// a piece whose body already has one of these figures is left alone, so this is safe
// to call more than once (e.g. from approve.ts as a safety net) without duplicating.
const WORDS_PER_IMAGE = 500;
const MARKER_CLASS = "ia-inline-img";

function countWords(html: string): number {
  return html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function withConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const id = Number(params.id);
  const row = await env.DB.prepare("SELECT id, title, body_html FROM investigaciones WHERE id = ?").bind(id).first<any>();
  if (!row) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });

  if (row.body_html.includes(MARKER_CLASS)) {
    return new Response(JSON.stringify({ ok: true, inserted: 0, note: "ya tiene imágenes de cuerpo, no se duplican" }), {
      headers: { "content-type": "application/json" },
    });
  }

  // Split on paragraph/heading/chart-placeholder boundaries so an image only ever lands
  // between blocks, never mid-sentence -- each chunk keeps its own tag intact.
  const blocks: string[] = row.body_html.split(/(?=<h2|<!--chart:)|(?<=<\/p>)|(?<=-->)/g).filter((b: string) => b.trim());

  // Greedy min-gap placement (confirmed live 2026-08-21 the earlier even-target version
  // clustered images: short paragraphs near section breaks let two precomputed targets
  // both resolve to nearly-adjacent boundaries). This walks once and only places an image
  // after >=WORDS_PER_IMAGE words have accumulated since the last one, and only right
  // before another real paragraph -- never immediately before an h2/chart placeholder
  // (which would orphan it with nothing to wrap) and never immediately after one (no
  // intro-less image right at the top of a section).
  let currentSectionTitle = "";
  let wordsSinceLastImage = 0;
  const insertions: { afterBlockIndex: number; sectionTitle: string }[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (/^<h2/.test(block)) {
      currentSectionTitle = stripTags(block);
      wordsSinceLastImage = 0; // don't let a long prior section's count bleed into a fresh one
      continue;
    }
    wordsSinceLastImage += countWords(block);
    const isParagraphEnd = /<\/p>\s*$/.test(block);
    if (!isParagraphEnd || wordsSinceLastImage < WORDS_PER_IMAGE) continue;

    const next = blocks[i + 1];
    const prev = blocks[i - 1];
    const nextIsHeadingOrChart = next && /^(<h2|<!--chart:)/.test(next);
    const prevWasImageSpot = prev && insertions.some((ins) => ins.afterBlockIndex === i - 1);
    if (nextIsHeadingOrChart || prevWasImageSpot) continue;

    insertions.push({ afterBlockIndex: i, sectionTitle: currentSectionTitle });
    wordsSinceLastImage = 0;
  }

  if (insertions.length === 0) {
    return new Response(JSON.stringify({ ok: true, inserted: 0, note: "pieza demasiado corta o sin puntos de párrafo válidos" }), {
      headers: { "content-type": "application/json" },
    });
  }

  // Concurrency-limited (not sequential) -- a long piece can need 15+ images, and
  // generating them one at a time risked minutes-long requests (confirmed live
  // 2026-08-21: a sequential run was still going after 30s+ and the request timed out
  // client-side). Same limit/pattern as generate-posts.ts's per-post image generation.
  const results = await withConcurrency(insertions, 4, async (ins, i) => {
    // Deliberately a short THEME phrase (the section heading), never the raw paragraph
    // text -- feeding Gemini a stats-dense excerpt made it render the numbers as garbled
    // infographic-style labels despite explicit "no text" instructions (confirmed live
    // 2026-08-21 on the China section). A clean heading has no digits to be tempted by.
    const prompt =
      `Purely conceptual editorial illustration for a long-form investigative piece titled "${row.title}", ` +
      `for the section: "${ins.sectionTitle}". Abstract visual metaphor only -- absolutely no text, no letters, ` +
      `no numbers, no digits, no charts, no diagrams, no data visualization, no logos, no recognizable people. ` +
      `Clean professional editorial illustration style, warm amber and deep orange color palette, cinematic lighting. ` +
      `Reminder: the image must contain zero writing or numerals of any kind.`;
    const r2Key = await generateInvestigacionImage(prompt);
    return r2Key ? { afterBlockIndex: ins.afterBlockIndex, r2Key, float: (i % 2 === 0 ? "left" : "right") as const } : null;
  });
  const generated = results.filter((r): r is { afterBlockIndex: number; r2Key: string; float: "left" | "right" } => r !== null);

  if (generated.length === 0) {
    return new Response(JSON.stringify({ error: "image generation failed for all insertion points" }), { status: 502 });
  }

  let newBodyHtml = "";
  for (let i = 0; i < blocks.length; i++) {
    newBodyHtml += blocks[i];
    const hit = generated.find((g) => g.afterBlockIndex === i);
    if (hit) {
      newBodyHtml += `<figure class="${MARKER_CLASS} ${MARKER_CLASS}--${hit.float}"><img src="/media/${hit.r2Key}?w=500" alt="" loading="lazy" /></figure>`;
    }
  }

  await env.DB.prepare("UPDATE investigaciones SET body_html = ? WHERE id = ?").bind(newBodyHtml, id).run();

  return new Response(JSON.stringify({ ok: true, inserted: generated.length, targetCount: insertions.length }), {
    headers: { "content-type": "application/json" },
  });
};

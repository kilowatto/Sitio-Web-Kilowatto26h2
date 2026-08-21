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
  const blocks = row.body_html.split(/(?=<h2|<!--chart:)|(?<=<\/p>)|(?<=-->)/g).filter((b: string) => b.trim());

  const totalWords = countWords(row.body_html);
  const imageCount = Math.max(0, Math.floor(totalWords / WORDS_PER_IMAGE) - 1); // -1: skip right after the hook, before the first real section
  if (imageCount === 0) {
    return new Response(JSON.stringify({ ok: true, inserted: 0, note: "pieza demasiado corta para imágenes de cuerpo" }), {
      headers: { "content-type": "application/json" },
    });
  }

  // Evenly spaced target word-counts, e.g. 3 images in a 2400-word piece land near word
  // 600, 1200, 1800 -- then each snaps to the next paragraph boundary at/after that point.
  const targets = Array.from({ length: imageCount }, (_, i) => Math.round((totalWords / (imageCount + 1)) * (i + 1)));

  let running = 0;
  let nextTargetIdx = 0;
  const insertions: { afterBlockIndex: number; contextText: string }[] = [];
  for (let i = 0; i < blocks.length && nextTargetIdx < targets.length; i++) {
    const block = blocks[i];
    running += countWords(block);
    // Only paragraph ends are valid drop points -- never right after an h2 or a chart
    // placeholder, which would visually orphan the image from any real body text.
    const isParagraphEnd = /<\/p>\s*$/.test(block);
    if (isParagraphEnd && running >= targets[nextTargetIdx]) {
      insertions.push({ afterBlockIndex: i, contextText: block.replace(/<[^>]+>/g, " ").slice(0, 400) });
      nextTargetIdx++;
    }
  }

  if (insertions.length === 0) {
    return new Response(JSON.stringify({ ok: true, inserted: 0, note: "no se encontraron puntos de párrafo válidos" }), {
      headers: { "content-type": "application/json" },
    });
  }

  const generated: { afterBlockIndex: number; r2Key: string; float: "left" | "right" }[] = [];
  for (let i = 0; i < insertions.length; i++) {
    const ins = insertions[i];
    const prompt = `Editorial illustration for a long-form investigative piece titled "${row.title}". This section discusses: "${ins.contextText}". Conceptual metaphor, no text, no letters, no numbers, no logos, no recognizable people, clean professional editorial illustration style, warm amber and deep orange color palette, cinematic lighting.`;
    const r2Key = await generateInvestigacionImage(prompt);
    if (r2Key) generated.push({ afterBlockIndex: ins.afterBlockIndex, r2Key, float: i % 2 === 0 ? "left" : "right" });
  }

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

  return new Response(JSON.stringify({ ok: true, inserted: generated.length, targetCount: imageCount }), {
    headers: { "content-type": "application/json" },
  });
};

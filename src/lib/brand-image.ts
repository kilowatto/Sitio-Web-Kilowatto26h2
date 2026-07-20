import { env } from "cloudflare:workers";

// Went through flux-1-schnell (Esteban: "horribles") then Leonardo lucid-origin (better
// composition, but its text-rendering strength backfired — it kept inserting fake garbled
// text and full social-media-post UI mockups even with explicit "no text" instructions,
// twice, confirmed live). Landed on SDXL base specifically because it's the only one of
// the three with a real `negative_prompt` field — the others only take positive prompts,
// so "avoid X" has to be phrased as a wish instead of an actual constraint.
const IMAGE_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";

const STAT_PATTERN = /\b\d{1,3}(?:[.,]\d+)?\s?(%|x|X)\b/;

export type ImageStyle = "illustration" | "infographic" | "real_photo" | "photorealistic";

// Esteban: different topics deserve different visual treatment (2026-07-20) — Curling and
// sushi content wants photorealistic renders, Yucatech/Founders content wants his own real
// event photos, comparison-style posts want infographics, most everything else works as a
// clean abstract icon. imageStyle comes from brand_topics.image_style (per-topic default).
export async function proposeImage(
  topicLabel: string,
  postContent: string,
  excludeKey?: string,
  imageStyle: ImageStyle = "illustration"
): Promise<string | null> {
  if (imageStyle === "real_photo") {
    return findRealPhoto(topicLabel, excludeKey);
  }

  // Every other style still tries a real gallery match first when one genuinely fits —
  // cheaper and more authentic than generating — before falling back to its AI treatment.
  const galleryMatch = await findRealPhoto(topicLabel, excludeKey);
  if (galleryMatch) return galleryMatch;

  if (imageStyle === "photorealistic") return generatePhotorealistic(topicLabel, postContent);
  if (imageStyle === "infographic") return generateInfographic(topicLabel, postContent);
  return generateConceptIcon(topicLabel, postContent);
}

async function findRealPhoto(topicLabel: string, excludeKey?: string): Promise<string | null> {
  const keywords = topicLabel
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  for (const kw of keywords) {
    const match = await env.DB.prepare(
      `SELECT r2_key FROM photos WHERE approval_status = 'approved' AND lower(ai_caption) LIKE ? AND r2_key != ? ORDER BY RANDOM() LIMIT 1`
    )
      .bind(`%${kw}%`, excludeKey ?? "")
      .first<any>();
    if (match?.r2_key) return match.r2_key;
  }
  return null;
}

// Best-effort infographic: asks for ONLY the specific number as the dominant element.
// Not guaranteed pixel-perfect (SDXL's text rendering is inherently unreliable, confirmed
// live 2026-07-20 — it ignored the number entirely on a test and drew a plain icon instead).
// A real guarantee would mean rendering the number ourselves via an SVG rasterizer rather
// than asking a diffusion model to draw it, which is a bigger build not done here.
async function generateInfographic(topicLabel: string, postContent: string): Promise<string | null> {
  const statMatch = postContent.match(STAT_PATTERN);
  const stat = statMatch?.[0];

  const prompt = stat
    ? `A minimalist infographic. The giant, bold number "${stat}" dominates the center of the image in solid dark ink color, huge sans-serif digits, nothing else drawn as text. Below it, small simple flat-vector icon related to "${topicLabel}" (${postContent.slice(0, 100)}). Plain cream background, one orange accent shape (#ff5f14). Clean flat vector style, no gradients, lots of empty space.`
    : `A minimalist data-visualization style graphic (bar chart or simple diagram shapes, no real numbers) representing "${topicLabel}": ${postContent.slice(0, 150)}. Flat vector infographic style, cream background, black and one orange accent color (#ff5f14), clean geometric shapes suggesting comparison or growth.`;

  const negativePrompt =
    "sentences, paragraphs, extra words, multiple numbers, small text, gibberish, illegible text, " +
    "website, webpage, app screen, user interface, UI, button, navigation bar, menu, " +
    "screenshot, mockup, advertisement, poster layout, person, people, face, portrait, hands, " +
    "photorealistic, photo, realistic, complex, busy, cluttered, crosshatching, grid, noise, texture";

  return runImageModel(prompt, negativePrompt);
}

async function generateConceptIcon(topicLabel: string, postContent: string): Promise<string | null> {
  // Grounded in the actual post text, not just the generic topic pillar name — a post
  // about a specific stat/story needs its own imagery, not "the topic's" stock icon.
  const prompt = `A single bold flat-vector icon centered on a plain solid cream background, symbolizing this specific idea: "${postContent.slice(0, 200)}" (broader topic: ${topicLabel}). Only 2-3 simple shapes total (a circle, a curved line, one solid orange shape) — large, clean, uncluttered, lots of empty negative space around it. Style: modern minimalist app icon / corporate emblem, thick even linework, no gradients, no shading, no fine detail, no hatching.`;
  const negativePrompt =
    "text, letters, words, numbers, typography, writing, caption, title, logo, watermark, " +
    "website, webpage, app screen, user interface, UI, button, navigation bar, menu, icon set, " +
    "screenshot, mockup, advertisement, poster layout, person, people, face, portrait, hands, " +
    "photorealistic, photo, realistic, complex, busy, cluttered, crosshatching, grid, noise, texture, many lines, intricate detail";

  return runImageModel(prompt, negativePrompt);
}

async function generatePhotorealistic(topicLabel: string, postContent: string): Promise<string | null> {
  const prompt = `A high-quality photorealistic photograph illustrating: "${postContent.slice(0, 200)}" (topic: ${topicLabel}). Professional editorial photography style, natural lighting, shallow depth of field, realistic textures and detail, as if shot for a magazine feature. No text, no logos, no watermarks overlaid on the image.`;
  const negativePrompt =
    "text, letters, words, numbers, typography, watermark, logo, caption, " +
    "website, webpage, app screen, user interface, UI, button, screenshot, mockup, " +
    "cartoon, illustration, drawing, flat design, vector art, low quality, blurry, distorted, deformed";

  return runImageModel(prompt, negativePrompt);
}

async function runImageModel(prompt: string, negativePrompt: string): Promise<string | null> {
  try {
    // SDXL returns raw binary PNG (not { image: base64 } like the flux/leonardo models) —
    // env.AI.run() gives back a ReadableStream for binary-output models.
    const result: any = await env.AI.run(IMAGE_MODEL, {
      prompt,
      negative_prompt: negativePrompt,
      guidance: 7.5,
      num_steps: 20,
      width: 1200,
      height: 672,
    });

    const bytes = new Uint8Array(await new Response(result).arrayBuffer());
    if (bytes.length === 0) return null;

    const key = `photos/social-generated/${crypto.randomUUID()}.png`;
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "image/png" } });
    return key;
  } catch (err) {
    console.error("Image generation failed:", err);
    return null;
  }
}

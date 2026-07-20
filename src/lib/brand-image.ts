import { env } from "cloudflare:workers";

// Went through flux-1-schnell (Esteban: "horribles") then Leonardo lucid-origin (better
// composition, but its text-rendering strength backfired — it kept inserting fake garbled
// text and full social-media-post UI mockups even with explicit "no text" instructions,
// twice, confirmed live). Landed on SDXL base specifically because it's the only one of
// the three with a real `negative_prompt` field — the others only take positive prompts,
// so "avoid X" has to be phrased as a wish instead of an actual constraint.
const IMAGE_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";

// Tries an approved real photo whose caption loosely matches the topic first (cheaper,
// more authentic than a generated image); falls back to AI generation only if nothing fits.
export async function proposeImage(topicLabel: string, postContent: string): Promise<string | null> {
  const keywords = topicLabel
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  for (const kw of keywords) {
    const match = await env.DB.prepare(
      `SELECT r2_key FROM photos WHERE approval_status = 'approved' AND lower(ai_caption) LIKE ? ORDER BY RANDOM() LIMIT 1`
    )
      .bind(`%${kw}%`)
      .first<any>();
    if (match?.r2_key) return match.r2_key;
  }

  return generateImage(topicLabel, postContent);
}

async function generateImage(topicLabel: string, postContent: string): Promise<string | null> {
  try {
    const prompt = `A single bold flat-vector icon centered on a plain solid cream background, symbolizing "${topicLabel}". Only 2-3 simple shapes total (a circle, a curved line, one solid orange shape) — large, clean, uncluttered, lots of empty negative space around it. Style: modern minimalist app icon / corporate emblem, thick even linework, no gradients, no shading, no fine detail, no hatching.`;
    const negativePrompt =
      "text, letters, words, numbers, typography, writing, caption, title, logo, watermark, " +
      "website, webpage, app screen, user interface, UI, button, navigation bar, menu, icon set, " +
      "screenshot, mockup, advertisement, poster layout, person, people, face, portrait, hands, " +
      "photorealistic, photo, realistic, complex, busy, cluttered, crosshatching, grid, noise, texture, many lines, intricate detail";

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

import { env } from "cloudflare:workers";

const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

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

  return generateImage(postContent);
}

async function generateImage(postContent: string): Promise<string | null> {
  try {
    const prompt = `A clean, professional editorial illustration suitable for a tech-industry social media post. Context: ${postContent.slice(0, 200)}. Style: modern, minimal, warm orange accent color, no text or logos.`;
    const result: any = await env.AI.run(IMAGE_MODEL, { prompt, num_steps: 4 });

    // flux-1-schnell returns { image: base64string }
    const base64 = result?.image;
    if (!base64) return null;

    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const key = `photos/social-generated/${crypto.randomUUID()}.png`;
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "image/png" } });
    return key;
  } catch (err) {
    console.error("Image generation failed:", err);
    return null;
  }
}

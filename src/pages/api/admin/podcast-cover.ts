import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { generateWithGemini } from "../../../lib/brand-image";

export const prerender = false;

// Generates the podcast cover.
//
// Apple's requirements: square, 1400-3000px, JPEG or PNG, RGB, NO alpha channel.
//
// Deliberately NO text in the prompt. Apple does not require a wordmark in the artwork, and
// every existing Larry image that tried to render text produced garbage ("FRIDA NOCOCO", "DIA
// NOGOHO"). A clean recognizable Larry beats a title spelled wrong. If a wordmark is wanted
// later it should be composited as real type, not generated.
const PROMPT =
  "Square album cover portrait of a photorealistic anthropomorphic rhinoceros with warm orange " +
  "pebbled skin, wearing thin wire-rimmed eyeglasses and a solid bright orange hoodie. " +
  "Head-and-shoulders, turned slightly off-axis, warm confident expression, looking just past " +
  "the camera. One modest horn low on the muzzle. Dramatic studio lighting, deep neutral " +
  "background with subtle vignette, cinematic and editorial, like a magazine cover portrait. " +
  "Absolutely no text, no letters, no numbers, no logos, no wordmarks anywhere in the image. " +
  "Perfectly square composition with the head centered and generous headroom.";

export const POST: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const bytes = await generateWithGemini(PROMPT);
    if (!bytes) return new Response(JSON.stringify({ error: "Gemini no devolvió imagen" }), { status: 500 });

    // Force JPEG at 1500px square: strips any alpha channel (which Apple rejects) and lands
    // inside the 1400-3000 range regardless of what the model returned.
    const out = await (env as any).IMAGES.input(new Response(bytes).body!)
      .transform({ width: 1500, height: 1500, fit: "cover" })
      .output({ format: "image/jpeg", quality: 90 });
    const jpeg = new Uint8Array(await new Response(out.image()).arrayBuffer());

    const key = "media/podcast/cover.jpg";
    await env.MEDIA.put(key, jpeg, { httpMetadata: { contentType: "image/jpeg" } });

    return new Response(
      JSON.stringify({ ok: true, key, bytes: jpeg.length, preview: `https://kilowatto.com/media/${key}` }, null, 2),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }, null, 2), { status: 500 });
  }
};

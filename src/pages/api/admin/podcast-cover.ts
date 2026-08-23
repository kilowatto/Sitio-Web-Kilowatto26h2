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
// The glasses are the problem. Every generation so far put them somewhere between wrong and
// absurd -- Esteban's note was that one lens ended up floating over the horn. A rhino skull has
// no bridge where wire frames could sit and no ears where arms could hook, so the model has
// nothing to anchor them to and invents a placement each time. Dropping them entirely is the fix
// that actually works; the alternatives below are kept so the choice is made by looking.
const PROMPTS: Record<string, string> = {
  "sin-lentes":
  "Square album cover portrait of a photorealistic anthropomorphic rhinoceros with warm orange " +
  "pebbled skin, wearing a solid bright orange hoodie. No eyewear of any kind. " +
  "Head-and-shoulders, turned slightly off-axis, warm confident expression, looking just past " +
  "the camera. One modest horn low on the muzzle. Dramatic studio lighting, deep neutral " +
  "background with subtle vignette, cinematic and editorial, like a magazine cover portrait. " +
  "Absolutely no text, no letters, no numbers, no logos, no wordmarks anywhere in the image. " +
  "Perfectly square composition with the head centered and generous headroom.",

  "lentes-bien":
    "Square album cover portrait of a photorealistic anthropomorphic rhinoceros with warm orange " +
    "pebbled skin, wearing a solid bright orange hoodie and round eyeglasses. The eyeglasses sit " +
    "high on the face directly in front of BOTH eyes, well above the horn, with the frame " +
    "horizontal and level and the arms running back along the sides of the head. The horn is " +
    "below and in front of the glasses and never touches them. Head-and-shoulders, turned " +
    "slightly off-axis, warm confident expression. Dramatic studio lighting, deep neutral " +
    "background with subtle vignette, cinematic and editorial. Absolutely no text, no letters, " +
    "no numbers, no logos anywhere. Perfectly square, head centered, generous headroom.",

  "perfil":
    "Square album cover portrait of a photorealistic anthropomorphic rhinoceros with warm orange " +
    "pebbled skin in a solid bright orange hoodie, seen in three-quarter profile looking off to " +
    "one side, thoughtful rather than posed. No eyewear. Strong single-source studio light from " +
    "the side, deep charcoal background, heavy cinematic shadow, editorial magazine portrait. " +
    "Absolutely no text, no letters, no numbers, no logos anywhere. Perfectly square composition.",

  "microfono":
    "Square album cover portrait of a photorealistic anthropomorphic rhinoceros with warm orange " +
    "pebbled skin in a solid bright orange hoodie, seated behind a large broadcast microphone on " +
    "a boom arm, leaning slightly toward it mid-conversation. No eyewear. Warm studio lighting " +
    "with soft rim light, dark neutral background, cinematic and editorial. Absolutely no text, " +
    "no letters, no numbers, no logos anywhere. Perfectly square composition.",
};

export const POST: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    // Variants write to DIFFERENT keys. A single fixed key means the second candidate silently
    // overwrites the first and the comparison is meaningless -- exactly the mistake the narration
    // A/B made twice before it was caught.
    const variant = url.searchParams.get("variant") ?? "sin-lentes";
    const prompt = PROMPTS[variant];
    if (!prompt) {
      return new Response(JSON.stringify({ error: `variante desconocida: ${variant}`, opciones: Object.keys(PROMPTS) }), { status: 400 });
    }
    const bytes = await generateWithGemini(prompt);
    if (!bytes) return new Response(JSON.stringify({ error: "Gemini no devolvió imagen" }), { status: 500 });

    // Force JPEG at 1500px square: strips any alpha channel (which Apple rejects) and lands
    // inside the 1400-3000 range regardless of what the model returned.
    const out = await (env as any).IMAGES.input(new Response(bytes).body!)
      .transform({ width: 1500, height: 1500, fit: "cover" })
      .output({ format: "image/jpeg", quality: 90 });
    const jpeg = new Uint8Array(await new Response(out.image()).arrayBuffer());

    const key = variant === "publicar" ? "media/podcast/cover.jpg" : `media/podcast/cover-${variant}.jpg`;
    await env.MEDIA.put(key, jpeg, { httpMetadata: { contentType: "image/jpeg" } });

    return new Response(
      JSON.stringify({ ok: true, key, bytes: jpeg.length, preview: `https://kilowatto.com/media/${key}` }, null, 2),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }, null, 2), { status: 500 });
  }
};

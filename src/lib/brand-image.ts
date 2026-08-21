import { env } from "cloudflare:workers";

// Went through flux-1-schnell (Esteban: "horribles") then Leonardo lucid-origin (better
// composition, but its text-rendering strength backfired — it kept inserting fake garbled
// text and full social-media-post UI mockups even with explicit "no text" instructions,
// twice, confirmed live). Landed on SDXL base specifically because it's the only one of
// the three with a real `negative_prompt` field — the others only take positive prompts,
// so "avoid X" has to be phrased as a wish instead of an actual constraint.
const IMAGE_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";

// Diffusion models (SDXL, Flux, Lucid Origin) are structurally unable to render legible
// text/numbers no matter the prompt — confirmed live 2026-07-20. Gemini's image model is a
// different architecture trained specifically for legible in-image text, so the infographic
// and photorealistic-mascot (Larry) generators try it FIRST, straight against Google's API.
const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";

// Fallback when Gemini isn't available (no key, no billing, quota, transient error) — per
// Esteban's call (2026-07-20): "ve a Google, ten un fallback a Cloudflare con el mejor
// modelo que tenga". Tried FLUX.2 [dev] (Workers AI's newest image model) here first, but its
// multipart/form-data contract hung indefinitely in production on every attempt (confirmed
// live 2026-07-20, killed after 2+ minutes with no response) — reverted to the proven SDXL
// path below rather than ship an unreliable fallback. Worth revisiting if Cloudflare's FLUX.2
// binding stabilizes.

const STAT_PATTERN = /\b\d{1,3}(?:[.,]\d+)?\s?(%|x|X)\b/;

// Larry's visual identity (Esteban's reference images, 2026-07-20): a recurring mascot
// instead of a generic stock-photo subject, so photorealistic/infographic posts are
// instantly recognizable as "a Kilowatto post" the same way a consistent avatar would be.
// Every scene draws the same character, but NOT the same outfit every time (confirmed live
// 2026-07-22: every generated post had Larry in the exact same tracksuit-and-pants combo) —
// picked randomly per call from a fixed athleisure/Adidas wardrobe so it varies across posts
// while staying on-brand (never anything outside the Adidas-style athletic look).
const LARRY_OUTFITS = [
  "a navy blue Adidas tracksuit (jacket and matching pants) with the three white stripes down the sleeves and legs, white Adidas sneakers",
  "a black Adidas hoodie with white three-stripe sleeves, dark jeans, white low-top sneakers",
  "an orange and white Adidas track jacket over a plain white t-shirt, black athletic shorts, black-and-white sneakers",
  "a heather-grey Adidas polo shirt, navy chino shorts, plain white low-top sneakers",
  "a full white Adidas tracksuit with navy three stripes, navy blue sneakers",
  "a forest-green Adidas windbreaker over a white t-shirt, black joggers, chunky white sneakers",
  "a red Adidas zip-up track jacket, grey sweatpants, black-and-red sneakers",
];

function larryCharacterDescription(): string {
  const outfit = LARRY_OUTFITS[Math.floor(Math.random() * LARRY_OUTFITS.length)];
  return (
    "Larry: an anthropomorphic orange rhinoceros with a friendly, expressive face, standing " +
    `upright like a person, wearing ${outfit}. Photorealistic, high-detail fur/skin texture, ` +
    "shot like a real photograph — not a cartoon, not a plush mascot suit, not a logo."
  );
}

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

// Real infographic via Gemini (legible text/data — the thing SDXL can never do). Falls back
// to the old best-effort SDXL abstraction only if GOOGLE_AI_STUDIO_KEY isn't configured or
// the Gemini call fails, so this never becomes a hard dependency for the pipeline to run.
async function generateInfographic(topicLabel: string, postContent: string): Promise<string | null> {
  const statMatch = postContent.match(STAT_PATTERN);
  const stat = statMatch?.[0];

  const geminiPrompt = `Foto realista de ${larryCharacterDescription()}

Escena: Larry está de pie junto a una pantalla grande o pizarra profesional en una sala moderna de conferencias/oficina, señalando o presentando una infografía real que aparece EN esa pantalla/pizarra, como si estuviera dando una charla. La infografía debe ilustrar este post de redes sociales, en español:
"${postContent.slice(0, 400)}"
Tema general: ${topicLabel}.

Requisitos muy importantes:
- La infografía en la pantalla/pizarra debe tener texto REAL y legible, iconos simples y datos claros — no un icono abstracto genérico.
${stat ? `- La cifra "${stat}" debe aparecer como el elemento central de esa infografía, grande y perfectamente legible.` : "- La infografía debe usar un gráfico simple (barras, comparación o diagrama de flujo) con etiquetas de texto breves y legibles, sin inventar cifras que no estén en el post."}
- Paleta de colores CÁLIDOS en la infografía, predominando el naranja (similar a #ff5f14) sobre fondo crema o negro, con acentos ámbar.
- Todo el texto debe estar en español, ortografía correcta, perfectamente legible.
- No inventes nombres de marca, logotipos ni URLs que no te haya dado.
- Fotografía editorial profesional, iluminación natural, como para una revista de tecnología.`;

  const geminiBytes = await generateWithGemini(geminiPrompt);
  if (geminiBytes) return storeImageBytes(geminiBytes, "image/png");

  // Fallback: best-effort SDXL abstraction (no reliable text, but keeps the pipeline moving).
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
  // "illustration" is the DEFAULT style (most topics use it) — it was the one style that
  // never tried Gemini/Larry at all, going straight to a generic abstract SDXL icon with no
  // mascot in it (confirmed live 2026-07-21: Esteban got a plain geometric shape instead of
  // Larry). Bring it in line with photorealistic/infographic: Gemini+Larry first, same
  // abstract-icon SDXL prompt below only as the fallback.
  const geminiPrompt = `Foto realista de ${larryCharacterDescription()}

Escena: Larry haciendo algo concreto y visualmente claro relacionado con este post de redes sociales:
"${postContent.slice(0, 300)}"
Tema general: ${topicLabel}.

Requisitos:
- La escena debe representar la idea de forma literal y reconocible, no una pose genérica.
- Fotografía editorial profesional, iluminación natural, poca profundidad de campo, como para una revista de tecnología.
- Sin texto superpuesto, sin logotipos inventados ni marcas de agua (letreros o pantallas reales dentro de la escena sí pueden tener texto genérico).`;

  const geminiBytes = await generateWithGemini(geminiPrompt);
  if (geminiBytes) return storeImageBytes(geminiBytes, "image/png");

  // Fallback: abstract SDXL icon (no Larry — SDXL can't reliably keep a consistent
  // character across generations), only reached if Gemini isn't configured or fails.
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
  // Larry (the mascot) is the subject when Gemini is available — falls back to a
  // Larry-less generic SDXL photo only if Gemini isn't configured or fails.
  const geminiPrompt = `Foto realista de ${larryCharacterDescription()}

Escena: Larry haciendo algo concreto y natural relacionado con este post (no una pose genérica ni mirando a cámara sin motivo):
"${postContent.slice(0, 300)}"
Tema general: ${topicLabel}.

Requisitos:
- La escena y los objetos a su alrededor deben tener sentido con el contenido del post de arriba.
- Fotografía editorial profesional, iluminación natural, poca profundidad de campo, como para una revista.
- Sin texto superpuesto, sin logotipos ni marcas de agua añadidos sobre la imagen (letreros o pantallas reales dentro de la escena sí pueden tener texto).`;

  const geminiBytes = await generateWithGemini(geminiPrompt);
  if (geminiBytes) return storeImageBytes(geminiBytes, "image/png");

  // Fallback: generic SDXL photo (no Larry — SDXL can't reliably keep a consistent
  // character across generations, so it isn't worth the prompt tokens here).
  const prompt = `A high-quality photorealistic photograph illustrating: "${postContent.slice(0, 200)}" (topic: ${topicLabel}). Professional editorial photography style, natural lighting, shallow depth of field, realistic textures and detail, as if shot for a magazine feature. No text, no logos, no watermarks overlaid on the image.`;
  const negativePrompt =
    "text, letters, words, numbers, typography, watermark, logo, caption, " +
    "website, webpage, app screen, user interface, UI, button, screenshot, mockup, " +
    "cartoon, illustration, drawing, flat design, vector art, low quality, blurry, distorted, deformed";

  return runImageModel(prompt, negativePrompt);
}

// For the research-assisted idea compositor (Esteban gives a rough idea, Larry researches
// it and writes the post) — the illustration is always Larry doing something concretely
// tied to the researched topic (e.g. "installing the new NVIDIA Spark processor"), per
// Esteban's explicit call that Larry should be the protagonist whenever it applies.
export async function generateLarryScene(ideaText: string, researchSummary: string): Promise<string | null> {
  const geminiPrompt = `Foto realista de ${larryCharacterDescription()}

Escena: Larry haciendo algo concreto y visualmente claro relacionado con esta idea de post:
"${ideaText}"

Contexto investigado (para que la escena sea precisa, no genérica):
${researchSummary.slice(0, 600)}

Requisitos:
- La acción de Larry debe representar la idea de forma literal y reconocible (ej. si es sobre un procesador nuevo, Larry sosteniendo/instalando/inspeccionando un procesador o servidor real).
- Fotografía editorial profesional, iluminación natural, poca profundidad de campo, como para una revista de tecnología.
- Sin texto superpuesto, sin logotipos inventados ni marcas de agua (letreros o pantallas reales dentro de la escena sí pueden tener texto genérico).`;

  const geminiBytes = await generateWithGemini(geminiPrompt);
  if (geminiBytes) return storeImageBytes(geminiBytes, "image/png");

  // Fallback: generic SDXL photo, no Larry (same reasoning as generatePhotorealistic's
  // fallback — SDXL can't reliably keep a consistent character across generations).
  const prompt = `A high-quality photorealistic photograph illustrating: "${ideaText}". Professional editorial photography style, natural lighting, shallow depth of field, realistic textures and detail, as if shot for a magazine feature. No text, no logos, no watermarks overlaid on the image.`;
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
    return storeImageBytes(bytes, "image/png");
  } catch (err) {
    console.error("Image generation failed:", err);
    return null;
  }
}

export async function storeImageBytes(bytes: Uint8Array, contentType: string): Promise<string | null> {
  if (bytes.length === 0) return null;
  const key = `photos/social-generated/${crypto.randomUUID()}.png`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } });
  return key;
}

// Calls Gemini's image model directly against Google's API. Tried proxying through
// Cloudflare AI Gateway first (kept everything visible in one dashboard), but it returned
// a generic 401 regardless of gateway name/config, so this calls Google directly instead —
// one less unconfirmed moving part. Requires GOOGLE_AI_STUDIO_KEY as a Worker secret with
// billing enabled on the Google AI Studio project (confirmed working live 2026-07-21).
export async function generateWithGemini(prompt: string): Promise<Uint8Array | null> {
  const apiKey = (env as any).GOOGLE_AI_STUDIO_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });

    if (!res.ok) {
      console.error("Gemini image generation failed:", res.status, await res.text());
      return null;
    }

    const data: any = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p?.inlineData?.data);
    if (!imagePart) return null;

    const binary = atob(imagePart.inlineData.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch (err) {
    console.error("Gemini image generation error:", err);
    return null;
  }
}

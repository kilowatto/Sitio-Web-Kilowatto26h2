import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { generateWithGemini, storeImageBytes } from "../../../lib/brand-image";

export const prerender = false;

// Finds a Larry portrait that HeyGen's face detector actually accepts.
//
// The existing canonical portrait fails with "No face detected" -- a three-quarter rhino
// profile whose mouth is hidden under the snout, which is precisely what HeyGen's help center
// lists under "usually doesn't work well" (beaks/snouts that hide the mouth area).
//
// The useful discovery is that face detection rejects BEFORE billing, so iterating on the
// portrait is free and only a passing candidate ever costs a render. That turns Larry's facial
// design from a taste question into a measurable constraint: generate variants, test each,
// keep whatever passes.
//
// Every prompt below forbids text. The existing Larry images are full of garbled AI text
// ("FRIDA NOCOCO", "DIA NOGOHO") because nothing told the model to stay away from it.

const BASE_LARRY =
  "Photorealistic anthropomorphic rhinoceros character with warm orange-brown pebbled skin. " +
  "He wears plain unbranded athletic clothing: a solid-color performance t-shirt or hoodie with " +
  "absolutely no logos, no swooshes, no stripes, no wordmarks. Studio portrait lighting, " +
  "neutral seamless backdrop. Absolutely no text, no letters, no numbers, no signage anywhere " +
  "in the image. High detail, sharp focus, professional character photography.";

// Ordered from "closest to the current look" to "most human facial geometry", so the result
// tells us how far Larry has to move from the existing design rather than just yes/no.
const VARIANTS: Record<string, string> = {
  frontal_snout: `${BASE_LARRY} Head-and-shoulders portrait facing the camera DEAD ON, perfectly frontal, symmetrical. ` +
    "Both eyes fully visible, open, and looking straight into the lens. His mouth is clearly defined with a " +
    "visible lip line across the front of the muzzle, slightly parted as if beginning to speak. Single short horn. " +
    "The head fills most of the frame.",

  frontal_wide_mouth: `${BASE_LARRY} Tight frontal head-and-shoulders portrait, facing the camera directly. ` +
    "His muzzle is SHORTER and BROADER than a real rhinoceros so the mouth reads clearly: a wide, distinctly " +
    "human-proportioned mouth with visible upper and lower lips, slightly open showing a hint of teeth, " +
    "positioned at the front of the face rather than underneath a long snout. Large expressive forward-facing " +
    "eyes with visible whites and clear eyelids, human-like size and placement. Small horn that does not cross " +
    "or obscure the face. The head fills the frame.",

  humanoid_face: `${BASE_LARRY} Tight frontal portrait, facing camera. His face uses HUMAN facial proportions ` +
    "while keeping rhinoceros identity: flat frontal face plane, clearly defined human-shaped mouth with full " +
    "visible lips centered on the face, large expressive human-placed eyes, defined forehead, cheeks and jawline. " +
    "The rhino character comes from skin texture, ears and a small horn, not from a long animal snout. " +
    "Friendly warm expression, mouth slightly open mid-speech. Head and shoulders fill the frame.",
};

// Gemini returns PNG; HeyGen's URL intake insists on JPEG. Re-encode and store with a .jpg
// key and a matching contentType so the served header agrees with the bytes.
async function storeAsJpeg(bytes: Uint8Array): Promise<string | null> {
  try {
    const result = await (env as any).IMAGES.input(new Response(bytes).body!).output({
      format: "image/jpeg",
      quality: 92, // a face-detection source image, so favor fidelity over bytes
    });
    const jpeg = new Uint8Array(await new Response(result.image()).arrayBuffer());
    const key = `photos/larry-face-lab/${crypto.randomUUID()}.jpg`;
    await env.MEDIA.put(key, jpeg, { httpMetadata: { contentType: "image/jpeg" } });
    return key;
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ url, request }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json<{ variants?: string[] }>().catch(() => ({}) as any);
  const wanted = body?.variants?.length ? body.variants : Object.keys(VARIANTS);

  const results: any[] = [];
  for (const name of wanted) {
    const prompt = VARIANTS[name];
    if (!prompt) {
      results.push({ variant: name, error: "variante desconocida" });
      continue;
    }
    try {
      const bytes = await generateWithGemini(prompt);
      if (!bytes) {
        results.push({ variant: name, error: "Gemini no devolvió imagen" });
        continue;
      }
      // HeyGen rejects PNG on the URL path with "Content type not match image/png !=
      // image/jpeg" despite its docs listing JPG/PNG, so re-encode to real JPEG before
      // storing. Uses the same IMAGES binding the media route already relies on.
      const r2Key = await storeAsJpeg(bytes);
      results.push({
        variant: name,
        r2Key,
        // Public URL HeyGen can fetch. Uses the plain image route (no Range needed for a still).
        publicUrl: r2Key ? `https://kilowatto.com/media/${r2Key}` : null,
      });
    } catch (err: any) {
      results.push({ variant: name, error: String(err?.message ?? err) });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};

// Runs each candidate past HeyGen's face detector WITHOUT rendering. A 400
// "No face detected" costs nothing, so this is the free gate before any paid render.
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const imageUrl = url.searchParams.get("imageUrl");
  if (!imageUrl) return new Response(JSON.stringify({ error: "falta imageUrl" }), { status: 400 });

  const res = await fetch("https://api.heygen.com/v3/videos", {
    method: "POST",
    headers: {
      "X-Api-Key": String((env as any).HEYGEN_API_KEY ?? "").trim(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "image",
      image: { type: "url", url: imageUrl },
      // A 1-second script keeps a PASSING candidate's render cost near zero (~$0.05) while
      // still proving the face was accepted.
      script: "Hola.",
      voice_id: "0077225a877e457db4572ccaf245910b",
      resolution: "1080p",
      aspect_ratio: "auto",
    }),
  });
  const text = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 400);
  }

  const message = String(parsed?.error?.message ?? "");
  return new Response(
    JSON.stringify(
      {
        imageUrl,
        httpStatus: res.status,
        faceDetected: res.status < 400,
        noFaceDetected: /no face detected/i.test(message),
        videoId: parsed?.data?.video_id ?? null,
        raw: parsed,
      },
      null,
      2
    ),
    { headers: { "Content-Type": "application/json" } }
  );
};

import { env } from "cloudflare:workers";

const RECRAFT_ENDPOINT = "https://external.api.recraft.ai/v1/images/generations";

// Confirmed live 2026-07-24 against the real API — Recraft's own docs only list style/model
// names for display (e.g. "Vector art", "Icon"), not the actual request slugs, so these were
// verified by trial:
//   - style: "vector_illustration", model: "recraftv3"  -> clean flat colored vector SVG
//   - style: "icon",                model: "recraftv2"  -> simple line-art icon SVG
//   - style: "realistic_image",     model: "recraftv3"  -> photorealistic raster (WebP)
//   - style: "digital_illustration",model: "recraftv3"  -> raster illustration
// The realistic_image style rendered a real, correctly-spelled "adidas" logo on a photorealistic
// orange rhino test — meaningfully better than the SDXL fallback in brand-image.ts, which can't
// reliably render legible text at all. Worth considering as an additional engine for Larry's
// photorealistic scenes if more testing holds up; not wired into that pipeline yet, kept as a
// standalone utility until asked to integrate it there.
export type RecraftModel = "recraftv3" | "recraftv3_vector" | "recraftv2" | "recraftv2_vector";
export type RecraftStyle = "vector_illustration" | "digital_illustration" | "realistic_image" | "icon" | (string & {});

export interface RecraftOptions {
  model?: RecraftModel;
  style?: RecraftStyle;
  size?: string; // must come from Recraft's fixed allow-list — "1024x1024" always works
  negativePrompt?: string;
}

// Returns an R2 key (servable via /media/{key}) or null on failure — same return contract
// as the other image generators in brand-image.ts, so callers can treat engines interchangeably.
export async function generateRecraftImage(prompt: string, opts: RecraftOptions = {}): Promise<string | null> {
  const apiKey = (env as any).RECRAFT_API_KEY;
  if (!apiKey) {
    console.error("generateRecraftImage: RECRAFT_API_KEY not configured");
    return null;
  }

  const body: Record<string, unknown> = {
    prompt,
    model: opts.model ?? "recraftv3",
    style: opts.style ?? "vector_illustration",
    size: opts.size ?? "1024x1024",
    n: 1,
  };
  if (opts.negativePrompt) body.negative_prompt = opts.negativePrompt;

  try {
    const res = await fetch(RECRAFT_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("Recraft image generation failed:", res.status, await res.text());
      return null;
    }
    const data: any = await res.json();
    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) return null;

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    if (bytes.length === 0) return null;

    // Vector styles (icon, vector_illustration) come back as SVG; raster styles
    // (realistic_image, digital_illustration) come back as WebP — read the real
    // content-type rather than assuming, so R2/the browser handle it correctly either way.
    const contentType = imgRes.headers.get("content-type") ?? "image/png";
    const ext = contentType.includes("svg") ? "svg" : contentType.includes("webp") ? "webp" : "png";

    const key = `photos/recraft-generated/${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } });
    return key;
  } catch (err) {
    console.error("Recraft image generation error:", err);
    return null;
  }
}

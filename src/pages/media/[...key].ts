import type { APIRoute } from "astro";
import { env, waitUntil } from "cloudflare:workers";

export const prerender = false;

const MAX_WIDTH = 2000;
const NON_TRANSFORMABLE = new Set(["image/svg+xml", "image/gif"]);

// R2 objects are the untouched originals photo-ingest.ts stores (no resizing at upload
// time) — a gallery thumbnail and the full-res original were otherwise indistinguishable,
// which is why /galeria could take minutes to load. `?w=` requests a Cloudflare Images
// binding transform at that width, output as AVIF when the browser's Accept header supports it
// (meaningfully smaller than WebP at the same visual quality) and WebP otherwise; anything that
// can't be transformed (missing param, SVG/GIF, or a transform error) falls back to the original
// bytes unchanged. The negotiated format is folded into the cache key so an AVIF-capable visitor
// and a WebP-only one never collide on the same cached entry.
export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key;
  if (!key) return new Response("not found", { status: 404 });

  const url = new URL(request.url);
  const widthParam = url.searchParams.get("w");
  const width = widthParam ? Math.min(MAX_WIDTH, Math.max(1, parseInt(widthParam, 10) || 0)) : 0;
  const acceptsAvif = (request.headers.get("accept") ?? "").includes("image/avif");
  const outputFormat = acceptsAvif ? "image/avif" : "image/webp";

  const cache = caches.default;
  const cacheKeyUrl = new URL(url.toString());
  cacheKeyUrl.searchParams.set("_fmt", acceptsAvif ? "avif" : "webp");
  const cacheKey = new Request(cacheKeyUrl.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const object = await env.MEDIA.get(key);
  if (!object) return new Response("not found", { status: 404 });

  const contentType = object.httpMetadata?.contentType ?? "image/jpeg";
  const buffer = await object.arrayBuffer();
  const canTransform = width > 0 && contentType.startsWith("image/") && !NON_TRANSFORMABLE.has(contentType);

  let response: Response;
  if (canTransform) {
    try {
      const result = await env.IMAGES.input(new Response(buffer).body!)
        .transform({ width, fit: "scale-down" })
        // 75 is Cloudflare's own suggested floor for squeezing photo bytes hard — still
        // visually clean, meaningfully smaller than the default 85.
        .output({ format: outputFormat, quality: 75 });
      response = new Response(result.image(), {
        headers: {
          "content-type": result.contentType(),
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      response = new Response(buffer, {
        headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" },
      });
    }
  } else {
    response = new Response(buffer, {
      headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" },
    });
  }

  waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};

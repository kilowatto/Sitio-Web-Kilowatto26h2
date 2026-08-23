import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Stable public URL for the podcast artwork, referenced from both feeds.
//
// A dedicated route rather than the raw /media/... path: directories submitted to Apple and
// Spotify cache this URL, and it should keep working if the object ever moves in R2. Served
// untransformed so the bytes stay exactly what was validated against Apple's spec (1500x1500,
// RGB, no alpha) -- the /media route's AVIF/WebP negotiation would hand a podcast directory a
// format it may not accept.
export const GET: APIRoute = async () => {
  const object = await env.MEDIA.get("media/podcast/cover.jpg");
  if (!object) return new Response("not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=86400",
    },
  });
};

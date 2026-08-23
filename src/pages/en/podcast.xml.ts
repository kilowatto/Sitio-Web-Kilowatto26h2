import type { APIRoute } from "astro";
import { buildPodcastFeed } from "../../lib/podcast-feed";

export const prerender = false;

// English feed. A concrete /en/ file rather than relying on the [locale] catch-all: the feed
// exists for exactly two locales, and a real route makes that explicit instead of 404-ing
// inside a dynamic segment for the other ten.
export const GET: APIRoute = async () => {
  const xml = await buildPodcastFeed("en");
  if (!xml) return new Response("not found", { status: 404 });
  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};

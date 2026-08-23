import type { APIRoute } from "astro";
import { buildPodcastFeed, feedResponse } from "../../lib/podcast-feed";

export const prerender = false;

// English feed. A concrete /en/ file rather than relying on the [locale] catch-all: the feed
// exists for exactly two locales, and a real route makes that explicit instead of 404-ing
// inside a dynamic segment for the other ten.
export const GET: APIRoute = async ({ request }) => {
  const feed = await buildPodcastFeed("en");
  if (!feed) return new Response("not found", { status: 404 });
  return feedResponse(feed, request);
};

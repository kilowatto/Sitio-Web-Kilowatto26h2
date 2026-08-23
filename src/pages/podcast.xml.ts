import type { APIRoute } from "astro";
import { buildPodcastFeed, feedResponse } from "../lib/podcast-feed";

export const prerender = false;

// Spanish podcast feed. English lives at /en/podcast.xml -- one feed per language, since
// <language> is a channel-level tag and Apple treats a bilingual catalogue as two shows.
export const GET: APIRoute = async ({ request }) => {
  const feed = await buildPodcastFeed("es-MX");
  if (!feed) return new Response("not found", { status: 404 });
  return feedResponse(feed, request);
};

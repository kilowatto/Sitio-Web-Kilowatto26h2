import type { APIRoute } from "astro";
import { buildPodcastFeed } from "../lib/podcast-feed";

export const prerender = false;

// Spanish podcast feed. English lives at /en/podcast.xml -- one feed per language, since
// <language> is a channel-level tag and Apple treats a bilingual catalogue as two shows.
export const GET: APIRoute = async () => {
  const xml = await buildPodcastFeed("es-MX");
  if (!xml) return new Response("not found", { status: 404 });
  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      // Podcast clients poll often; an hour keeps them from hammering D1 while staying fresh
      // enough that a new episode shows up the same day.
      "cache-control": "public, max-age=3600",
    },
  });
};

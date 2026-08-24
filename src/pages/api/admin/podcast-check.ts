import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runPodcastMonitor, lastPodcastMonitor } from "../../../lib/podcast-monitor";

export const prerender = false;

function authed(url: URL): boolean {
  const t = url.searchParams.get("token");
  return t === env.ADMIN_TOKEN || t === env.SCRATCH_TOKEN;
}

// The last stored report, without re-running anything.
export const GET: APIRoute = async ({ url }) => {
  if (!authed(url)) return new Response("unauthorized", { status: 401 });
  return Response.json(await lastPodcastMonitor());
};

// Runs the checks. Called by the cron and by hand.
export const POST: APIRoute = async ({ url }) => {
  if (!authed(url)) return new Response("unauthorized", { status: 401 });
  return Response.json(await runPodcastMonitor());
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runAudioSweep, findPendingAudio, lastSweep } from "../../../lib/audio-sweeper";

export const prerender = false;

function authed(url: URL): boolean {
  const t = url.searchParams.get("token");
  return t === env.ADMIN_TOKEN || t === env.SCRATCH_TOKEN;
}

// What is missing, without generating anything. Safe to hit from the admin UI.
export const GET: APIRoute = async ({ url }) => {
  if (!authed(url)) return new Response("unauthorized", { status: 401 });
  return Response.json({ pending: await findPendingAudio(), lastSweep: await lastSweep() });
};

// Runs the sweep. Called by the 6-hourly cron and by hand.
export const POST: APIRoute = async ({ url }) => {
  if (!authed(url)) return new Response("unauthorized", { status: 401 });
  const limit = Number(url.searchParams.get("limit") ?? 2);
  return Response.json(await runAudioSweep(Number.isFinite(limit) ? limit : 2));
};

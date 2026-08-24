import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runClipSweep, findPendingClips, lastClipSweep } from "../../../lib/clip-sweeper";

export const prerender = false;

// GET reports what the sweep WOULD do; POST actually does it. Same split as the audio sweep --
// this one spends real money (narration plus container minutes), so seeing the plan has to be
// free.
export const GET: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });
  return Response.json({
    pending: await findPendingClips(),
    last: await lastClipSweep(),
    hasRenderService: !!(env as any).RENDER,
  });
};

export const POST: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });
  const limit = Number(url.searchParams.get("limit") ?? 1);
  return Response.json(await runClipSweep(Number.isFinite(limit) ? limit : 1));
};

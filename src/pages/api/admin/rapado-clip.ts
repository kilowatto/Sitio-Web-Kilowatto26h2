import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runRapadoClip } from "../../../lib/rapado-clip";

export const prerender = false;

// One-shot trigger for the "Esteban se rapó" personal clip (src/lib/rapado-clip.ts). Not on any
// cron -- this is a single hardcoded video, run once by hand from here or /admin.
export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const result = await runRapadoClip();
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 400,
    headers: { "content-type": "application/json" },
  });
};

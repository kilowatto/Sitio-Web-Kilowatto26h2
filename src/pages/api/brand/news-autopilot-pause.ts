import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { setNewsAutopilotPaused } from "../../../lib/news-reaction-trust";

export const prerender = false;

// Dedicated panic switch for the news-reaction auto-PUBLISH pipeline only (searching and
// proposing drafts for approval always keeps running) — separate from "Pausar todo" so
// Esteban can kill just this one risky piece without stopping normal idea/reshare posting.
export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ paused: boolean }>();
  await setNewsAutopilotPaused(body.paused);
  return new Response(JSON.stringify({ ok: true, paused: body.paused }), { headers: { "content-type": "application/json" } });
};

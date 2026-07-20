import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;
const KEY = "brand_autopilot_paused";

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ paused: boolean }>();
  await env.KILOWATTO_KV.put(KEY, body.paused ? "true" : "false");
  return new Response(JSON.stringify({ ok: true, paused: body.paused }), { headers: { "content-type": "application/json" } });
};

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const paused = (await env.KILOWATTO_KV.get(KEY)) === "true";
  return new Response(JSON.stringify({ paused }), { headers: { "content-type": "application/json" } });
};

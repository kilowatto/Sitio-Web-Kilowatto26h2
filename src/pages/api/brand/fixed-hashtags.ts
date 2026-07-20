import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;
const KEY = "brand_fixed_hashtags";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const value = (await env.KILOWATTO_KV.get(KEY)) ?? "";
  return new Response(JSON.stringify({ hashtags: value }), { headers: { "content-type": "application/json" } });
};

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ hashtags: string }>();
  await env.KILOWATTO_KV.put(KEY, body.hashtags ?? "");
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

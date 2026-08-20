import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getBraveUsageThisMonth } from "../../../lib/web-search";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const count = await getBraveUsageThisMonth();
  return new Response(JSON.stringify({ ok: true, count }), { headers: { "content-type": "application/json" } });
};

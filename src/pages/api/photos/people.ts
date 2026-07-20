import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Flat name list for the admin's autocomplete — deliberately simple, no photo IDs here.
export const GET: APIRoute = async ({ request }) => {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const { results } = await env.DB.prepare("SELECT name FROM people ORDER BY name").all();
  return new Response(JSON.stringify({ names: (results ?? []).map((r: any) => r.name) }), {
    headers: { "content-type": "application/json" },
  });
};

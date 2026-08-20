import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runPressWebSearch } from "../../../lib/press-web-search";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const summary = await runPressWebSearch();

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { "content-type": "application/json" },
  });
};

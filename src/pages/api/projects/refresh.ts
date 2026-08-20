import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { refreshProjects } from "../../../lib/projects-refresh";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const result = await refreshProjects();
  await env.KILOWATTO_KV.put("last_projects_refresh_at", new Date().toISOString()).catch(() => {});

  return new Response(JSON.stringify({ ok: true, ...result }), { headers: { "content-type": "application/json" } });
};

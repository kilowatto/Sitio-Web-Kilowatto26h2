import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

function checkToken(url: URL) {
  return url.searchParams.get("token") === env.ADMIN_TOKEN;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (!checkToken(url)) return new Response("unauthorized", { status: 401 });

  const res = await env.DB.prepare("SELECT * FROM press_saved_searches ORDER BY created_at DESC").all();
  const items = (res?.results ?? []).map((row: any) => ({
    ...row,
    include_terms: JSON.parse(row.include_terms),
    exclude_terms: JSON.parse(row.exclude_terms),
  }));

  return new Response(JSON.stringify({ ok: true, items }), { headers: { "content-type": "application/json" } });
};

export const DELETE: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (!checkToken(url)) return new Response("unauthorized", { status: 401 });

  const id = url.searchParams.get("id");
  if (!id) return new Response("id is required", { status: 400 });

  await env.DB.prepare("DELETE FROM press_saved_searches WHERE id = ?").bind(id).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

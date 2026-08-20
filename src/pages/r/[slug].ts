import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Public redirect for short links cited in posts (kilowatto.com/r/xxxx) — logs a click and
// bounces to the real URL. Never blocks the redirect on the click-count write succeeding.
export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  const row = await env.DB.prepare("SELECT target_url FROM short_links WHERE slug = ?").bind(slug).first<any>();
  if (!row) return new Response("not found", { status: 404 });

  env.DB.prepare("UPDATE short_links SET clicks = clicks + 1 WHERE slug = ?")
    .bind(slug)
    .run()
    .catch((err) => console.error("short link click increment failed:", err));

  return new Response(null, { status: 302, headers: { Location: row.target_url } });
};

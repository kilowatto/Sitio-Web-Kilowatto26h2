import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Public link-through endpoint: every press-mention link on the site points here instead of
// straight at the source, so a real click increments click_count before redirecting on to the
// actual article. No auth — anyone visiting the public site can click these.
export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  const mention = await env.DB.prepare(`SELECT url FROM press_mentions WHERE id = ?`).bind(id).first<any>();
  if (!mention?.url) return new Response("not found", { status: 404 });

  await env.DB.prepare(`UPDATE press_mentions SET click_count = click_count + 1 WHERE id = ?`).bind(id).run();

  return Response.redirect(mention.url, 302);
};

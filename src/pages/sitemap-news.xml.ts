import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Google News sitemap (separate from the regular sitemap.xml) — per Google's spec this must
// only list articles from the last 2 days; older ones are expected to age out on their own,
// not stay listed. This is purely the technical artifact Google News requires; actual
// inclusion still needs Esteban to apply and get accepted in Google Publisher Center — that
// review is manual on Google's side and can't be automated.
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export const GET: APIRoute = async () => {
  const urls: string[] = [];

  if (env?.DB) {
    const { results } = await env.DB.prepare(
      `SELECT slug, title, published_at FROM columns
       WHERE status = 'published' AND published_at >= date('now', '-2 days')
       ORDER BY published_at DESC`
    ).all<any>();

    for (const c of results ?? []) {
      urls.push(
        `  <url>
    <loc>https://kilowatto.com/columnas/${c.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>Kilowatto</news:name>
        <news:language>es</news:language>
      </news:publication>
      <news:publication_date>${c.published_at}</news:publication_date>
      <news:title>${escapeXml(c.title)}</news:title>
      <news:genres>Blog, Opinion</news:genres>
    </news:news>
  </url>`
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
};

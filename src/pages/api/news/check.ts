import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const QUERIES = [
  '"Esteban Rey" Kilowatto',
  '"Ignia Cloud" Esteban Rey',
  "Yucatech Festival Mérida",
];

const CLASSIFY_PROMPT = `Estás ayudando a filtrar menciones de prensa para el sitio personal de Esteban Rey Ortega, un CEO/inversionista tecnológico mexicano conocido como "Kilowatto", fundador de Ignia Cloud, DeSiCi, OnCloud (vendida), y del Yucatech Festival.

IMPORTANTE — estos NO son la misma persona/entidad, descarta cualquier artículo sobre ellos:
- Un cantautor/músico de rock y mariachi también llamado Esteban Rey (proyectos "Frida").
- IGNIA (ignia.vc), un fondo de venture capital fundado en 2007 — sin relación con Ignia Cloud.
- Cualquier otro "Esteban Rey" (hay varios en LinkedIn: diseñador gráfico en Mediaset España, desarrollador de software, etc).
- Octapus (Esteban ya no tiene ninguna relación con esa empresa).
- Finsus como inversión (Esteban NO es inversionista de Finsus, aunque puede aparecer junto a él como ponente de Yucatech).

Dado este título y fragmento de un artículo, responde SOLO un objeto JSON con este formato exacto, sin texto adicional:
{"about_him": "yes" | "no" | "unsure", "summary": "resumen de una oración en español si about_him es yes, si no cadena vacía"}`;

function parseRssItems(xml: string) {
  const items: { title: string; link: string; pubDate: string; source: string }[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const m of itemMatches) {
    const block = m[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "") ?? "";
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "") ?? "";
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
    const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "") ?? "";
    if (title && link) items.push({ title, link, pubDate, source });
  }
  return items;
}

async function classify(title: string) {
  const result: any = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: CLASSIFY_PROMPT },
      { role: "user", content: `Título: ${title}` },
    ],
    max_tokens: 200,
  });
  const raw = typeof result?.response === "object" ? JSON.stringify(result.response) : result?.response ?? "";
  const match = typeof raw === "string" ? raw.match(/\{[\s\S]*\}/) : null;
  if (typeof result?.response === "object") return result.response;
  if (!match) return { about_him: "unsure", summary: "" };
  try {
    return JSON.parse(match[0]);
  } catch {
    return { about_him: "unsure", summary: "" };
  }
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const summary = { found: 0, new: 0, confirmed: 0, uncertain: 0, rejected: 0 };

  try {
    for (const q of QUERIES) {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=MX&ceid=MX:es-419`;
      const res = await fetch(rssUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; kilowatto-news-bot/1.0)" } });
      const xml = await res.text();
      const items = parseRssItems(xml);
      summary.found += items.length;

      for (const item of items) {
        const existing = await env.DB.prepare("SELECT id FROM press_mentions WHERE url = ?").bind(item.link).first();
        if (existing) continue;
        summary.new++;

        const classification = await classify(item.title);
        const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : null;

        if (classification.about_him === "no") {
          summary.rejected++;
          await env.DB.prepare(
            `INSERT INTO press_mentions (url, outlet, title, published_at, summary, identity_confidence, status)
             VALUES (?, ?, ?, ?, '', 'rejected', 'rejected')`
          )
            .bind(item.link, item.source, item.title, publishedAt)
            .run();
          continue;
        }

        const confidence = classification.about_him === "yes" ? "confirmed" : "uncertain";
        if (confidence === "confirmed") summary.confirmed++;
        else summary.uncertain++;

        await env.DB.prepare(
          `INSERT INTO press_mentions (url, outlet, title, published_at, summary, identity_confidence, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`
        )
          .bind(item.link, item.source, item.title, publishedAt, classification.summary ?? "", confidence)
          .run();
      }
    }
  } catch (err: any) {
    console.error("News check error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err), summary }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { "content-type": "application/json" },
  });
};

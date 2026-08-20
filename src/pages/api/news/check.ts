import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { parseRssItems } from "../../../lib/rss";
import { snapshotArticle } from "../../../lib/press-snapshot";
import { stripHtml, extractThumbnail } from "../../../lib/html-text";
import { decodeGoogleNewsUrl } from "../../../lib/google-news-decode";
import { classifyPressCandidate } from "../../../lib/press-classify";

const USER_AGENT = "Mozilla/5.0 (compatible; KilowattoBot/1.0; +https://kilowatto.com)";

export const prerender = false;

// Widened 2026-07-23 — the original 3 queries only ever surfaced ~10 mentions total, while
// Esteban has 100+ real press mentions across his ~25-year career. Google News RSS also skews
// heavily toward recent/indexed news, so this still won't find older archived pieces; that's
// what press-web-search.ts (Brave Search, weekly cron) is for. This covers every company/project
// name across his history so future ongoing coverage is broad, not just "Kilowatto" mentions.
const QUERIES = [
  '"Esteban Rey" Kilowatto',
  '"Esteban Rey Ortega"',
  '"Ignia Cloud" Esteban Rey',
  '"Ignia Cloud" nube soberana',
  "Yucatech Festival Mérida",
  "Yucatech Festival Uri Levine",
  '"OnCloud" "Súbete a la Nube"',
  '"DeSiCi" Zoho México',
  '"Orange Rhino Investments"',
  '"Esteban Rey" cloud computing México',
];

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
        // item.link is Google's own redirect wrapper — it only resolves to the real article
        // via client-side JS, so a plain server-side fetch just gets Google's syndication shell
        // (generic placeholder image, no real article text). Decode it to the real URL first;
        // fall back to the wrapper link itself if decoding fails for any reason. We store realUrl
        // (not the wrapper) as `url`, so dedup has to check against the decoded form too — the
        // same article resurfaces across several cron runs until it ages out of the RSS feed.
        const decodedUrl = await decodeGoogleNewsUrl(item.link);
        const realUrl = decodedUrl ?? item.link;

        const existing = await env.DB.prepare("SELECT id FROM press_mentions WHERE url = ? OR url = ?").bind(realUrl, item.link).first();
        if (existing) continue;
        summary.new++;

        let articleHtml: string | null = null;
        let articleText = "";
        try {
          const res = await fetch(realUrl, {
            headers: { "user-agent": USER_AGENT },
            signal: AbortSignal.timeout(12_000),
            redirect: "follow",
          });
          if (res.ok) {
            articleHtml = await res.text();
            articleText = stripHtml(articleHtml);
          }
        } catch {
          // fall through with empty articleText — classify on title alone rather than
          // dropping the candidate entirely.
        }

        const classification = await classifyPressCandidate(item.title, articleText);
        const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : null;

        if (classification.about_him === "no") {
          summary.rejected++;
          await env.DB.prepare(
            `INSERT INTO press_mentions (url, outlet, title, published_at, summary, identity_confidence, status)
             VALUES (?, ?, ?, ?, '', 'rejected', 'rejected')`
          )
            .bind(realUrl, item.source, item.title, publishedAt)
            .run();
          continue;
        }

        const confidence = classification.about_him === "yes" ? "confirmed" : "uncertain";
        if (confidence === "confirmed") summary.confirmed++;
        else summary.uncertain++;

        // Only meaningful when we actually reached the real outlet page — Google's own shell
        // page has a generic, non-article-specific placeholder image, not worth storing.
        const thumbnailUrl = decodedUrl && articleHtml ? await extractThumbnail(articleHtml, realUrl) : null;

        const inserted = await env.DB.prepare(
          `INSERT INTO press_mentions (url, outlet, title, published_at, summary, identity_confidence, status, thumbnail_url)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
        )
          .bind(realUrl, item.source, item.title, publishedAt, classification.summary ?? "", confidence, thumbnailUrl)
          .run();

        // Preserve the source now, before it can disappear — never block insertion on this.
        // Reuses the fetch already done for classification instead of hitting the URL twice.
        const mentionId = inserted.meta.last_row_id;
        const { r2Key, archiveUrl } = await snapshotArticle(realUrl, mentionId, articleHtml ?? undefined);
        if (r2Key || archiveUrl) {
          await env.DB.prepare(`UPDATE press_mentions SET raw_content_r2_key = COALESCE(?, raw_content_r2_key), archive_url = COALESCE(?, archive_url) WHERE id = ?`)
            .bind(r2Key, archiveUrl, mentionId)
            .run();
        }
      }
    }
  } catch (err: any) {
    console.error("News check error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err), summary }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Lets the 6-hour cron trigger skip itself in scheduled-entry.mjs when a manual run (this
  // button, clicked from /admin/prensa) already covered the window — a literal Cron Trigger
  // fires on a fixed schedule and can't be rescheduled, but this makes it a no-op until 6h
  // have actually passed since the last real check, so a manual click "resets" the window.
  await env.KILOWATTO_KV.put("last_news_check_at", new Date().toISOString()).catch(() => {});

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { "content-type": "application/json" },
  });
};

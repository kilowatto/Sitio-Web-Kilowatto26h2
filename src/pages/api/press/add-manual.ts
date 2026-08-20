import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { classifyPressCandidate } from "../../../lib/press-classify";
import { snapshotArticle } from "../../../lib/press-snapshot";
import { stripHtml, extractThumbnail, isPlausibleImageUrl } from "../../../lib/html-text";

const USER_AGENT = "Mozilla/5.0 (compatible; KilowattoBot/1.0; +https://kilowatto.com)";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body: any = await request.json().catch(() => ({}));
  const articleUrl: string | undefined = body.url;
  const title: string = body.title ?? "";
  const thumbnailOverride: string | undefined = body.thumbnailOverride;
  if (!articleUrl) {
    return new Response(JSON.stringify({ error: "url is required" }), { status: 400 });
  }

  const existing = await env.DB.prepare("SELECT id FROM press_mentions WHERE url = ?").bind(articleUrl).first();
  if (existing) {
    return new Response(JSON.stringify({ error: "already exists" }), { status: 409 });
  }

  let articleHtml: string | null = null;
  let articleText = "";
  try {
    const res = await fetch(articleUrl, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (res.ok) {
      articleHtml = await res.text();
      articleText = stripHtml(articleHtml);
    }
  } catch {
    // fall through with empty articleText — classify on title alone rather than blocking
    // a manual add the human already vetted by clicking it.
  }

  const classification = await classifyPressCandidate(title, articleText || body.snippet || "");
  const confidence = classification.about_him === "yes" ? "confirmed" : classification.about_him === "no" ? "rejected" : "uncertain";

  let thumbnailUrl: string | null = null;
  if (thumbnailOverride && isPlausibleImageUrl(thumbnailOverride)) {
    thumbnailUrl = thumbnailOverride;
  } else if (articleHtml) {
    thumbnailUrl = await extractThumbnail(articleHtml, articleUrl);
  }

  const inserted = await env.DB.prepare(
    `INSERT INTO press_mentions (url, outlet, title, published_at, summary, identity_confidence, status, thumbnail_url)
     VALUES (?, ?, ?, NULL, ?, ?, 'pending', ?)`
  )
    .bind(articleUrl, new URL(articleUrl).hostname, title, classification.summary ?? "", confidence, thumbnailUrl)
    .run();

  const mentionId = inserted.meta.last_row_id;
  const { r2Key, archiveUrl } = await snapshotArticle(articleUrl, mentionId, articleHtml ?? undefined);
  if (r2Key || archiveUrl) {
    await env.DB.prepare(`UPDATE press_mentions SET raw_content_r2_key = COALESCE(?, raw_content_r2_key), archive_url = COALESCE(?, archive_url) WHERE id = ?`)
      .bind(r2Key, archiveUrl, mentionId)
      .run();
  }

  return new Response(JSON.stringify({ ok: true, id: mentionId, confidence }), {
    headers: { "content-type": "application/json" },
  });
};

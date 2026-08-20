import { env } from "cloudflare:workers";
import { webSearch } from "./web-search";
import { classifyPressCandidate } from "./press-classify";
import { snapshotArticle } from "./press-snapshot";
import { stripHtml, extractThumbnail } from "./html-text";
import { buildBraveQuery } from "./press-query";

const USER_AGENT = "Mozilla/5.0 (compatible; KilowattoBot/1.0; +https://kilowatto.com)";

// Same broad query set as news/check.ts's Google News queries, plus the historical/case-study
// terms that only ever turned up real hits through manual WebSearch agents this session (Brave's
// index reaches further back than Google News RSS, which only surfaces recently-indexed items).
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
  '"Esteban Rey" Prochemex CMT',
  '"Esteban Rey" Pure Storage caso de éxito',
  '"Esteban Rey" Rubrik caso de éxito',
  '"Esteban Rey" Acronis México',
  '"Esteban Rey" Forbes México',
  '"Esteban Rey" LACNIC',
  '"Esteban Rey" ARIA Summit',
  '"Esteban Rey" América Digital',
];

export interface PressWebSearchSummary {
  found: number;
  new: number;
  confirmed: number;
  uncertain: number;
  rejected: number;
}

async function processResult(r: { url: string; title: string; snippet: string }, summary: PressWebSearchSummary): Promise<void> {
  const existing = await env.DB.prepare("SELECT id FROM press_mentions WHERE url = ?").bind(r.url).first();
  if (existing) return;
  summary.new++;

  let articleHtml: string | null = null;
  let articleText = "";
  try {
    const res = await fetch(r.url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (res.ok) {
      articleHtml = await res.text();
      articleText = stripHtml(articleHtml);
    }
  } catch {
    // fall through with empty articleText — classify on title/snippet alone rather than
    // dropping the candidate entirely.
  }

  const bodyText = articleText || r.snippet;
  const classification = await classifyPressCandidate(r.title, bodyText);

  if (classification.about_him === "no") {
    summary.rejected++;
    await env.DB.prepare(
      `INSERT INTO press_mentions (url, outlet, title, published_at, summary, identity_confidence, status)
       VALUES (?, ?, ?, NULL, '', 'rejected', 'rejected')`
    )
      .bind(r.url, new URL(r.url).hostname, r.title)
      .run();
    return;
  }

  const confidence = classification.about_him === "yes" ? "confirmed" : "uncertain";
  if (confidence === "confirmed") summary.confirmed++;
  else summary.uncertain++;

  const thumbnailUrl = articleHtml ? await extractThumbnail(articleHtml, r.url) : null;

  const inserted = await env.DB.prepare(
    `INSERT INTO press_mentions (url, outlet, title, published_at, summary, identity_confidence, status, thumbnail_url)
     VALUES (?, ?, ?, NULL, ?, ?, 'pending', ?)`
  )
    .bind(r.url, new URL(r.url).hostname, r.title, classification.summary ?? "", confidence, thumbnailUrl)
    .run();

  const mentionId = inserted.meta.last_row_id;
  const { r2Key, archiveUrl } = await snapshotArticle(r.url, mentionId, articleHtml ?? undefined);
  if (r2Key || archiveUrl) {
    await env.DB.prepare(`UPDATE press_mentions SET raw_content_r2_key = COALESCE(?, raw_content_r2_key), archive_url = COALESCE(?, archive_url) WHERE id = ?`)
      .bind(r2Key, archiveUrl, mentionId)
      .run();
  }
}

export async function runPressWebSearch(): Promise<PressWebSearchSummary> {
  const summary: PressWebSearchSummary = { found: 0, new: 0, confirmed: 0, uncertain: 0, rejected: 0 };

  for (const q of QUERIES) {
    const results = await webSearch(q, 10);
    summary.found += results.length;
    for (const r of results) {
      if (r.url) await processResult(r, summary);
    }
  }

  // Custom searches saved from the /admin/prensa advanced-search panel — re-run every week
  // until Esteban deletes them, so a one-off manual search keeps paying off going forward.
  const savedRes = await env.DB.prepare("SELECT * FROM press_saved_searches").all();
  for (const row of (savedRes?.results ?? []) as any[]) {
    const include = JSON.parse(row.include_terms);
    const exclude = JSON.parse(row.exclude_terms);
    const q = buildBraveQuery(include, exclude);
    const results = await webSearch(q, 20, !!row.global_scope);
    summary.found += results.length;
    for (const r of results) {
      if (r.url) await processResult(r, summary);
    }
    await env.DB.prepare("UPDATE press_saved_searches SET last_run_at = datetime('now') WHERE id = ?").bind(row.id).run();
  }

  return summary;
}

import { env } from "cloudflare:workers";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Cloudflare's own Web Search (wrangler websearch) returned "account_disabled" — it's gated
// behind an experimental/private beta with no self-service way to enable it (confirmed live
// 2026-07-20). Brave Search API instead: has a real free tier, simple REST API, no lock-in
// to Google/Bing for a personal site's research needs.
//
// global=true drops the MX/es region+language restriction — the admin advanced-search panel
// exposes this as a toggle; the automated pipelines (news/check's Google News queries and
// press-web-search's default QUERIES) always stay MX-scoped.
// freshness: Brave's own date-range filter ("pd" past day, "pw" past week, "pm" past month,
// "py" past year) — used by the weekly briefing so "última semana" is enforced by the API
// itself, not by us guessing from unreliable published-date metadata after the fact.
export async function webSearch(query: string, count = 5, global = false, freshness?: "pd" | "pw" | "pm" | "py"): Promise<SearchResult[]> {
  const apiKey = (env as any).BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    console.error("webSearch: BRAVE_SEARCH_API_KEY not configured");
    return [];
  }

  try {
    const params = new URLSearchParams({ q: query, count: String(Math.min(count, 20)) });
    if (!global) {
      params.set("country", "MX");
      params.set("search_lang", "es");
    }
    if (freshness) params.set("freshness", freshness);
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    });
    await incrementBraveUsage();
    if (!res.ok) {
      console.error("webSearch failed:", res.status, await res.text());
      return [];
    }
    const data: any = await res.json();
    const results = data?.web?.results ?? [];
    // Brave wraps matched terms in <strong> and HTML-escapes quotes/ampersands inside
    // title/description — clean both, otherwise "<strong>" and "&quot;" leak as literal text
    // in the admin preview and the AI classifier prompt.
    const clean = (s: string) =>
      s
        .replace(/<[^>]+>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
    return results.slice(0, count).map((r: any) => ({
      title: clean(r.title ?? ""),
      url: r.url ?? "",
      snippet: clean(r.description ?? ""),
    }));
  } catch (err) {
    console.error("webSearch error:", err);
    return [];
  }
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

async function incrementBraveUsage(): Promise<void> {
  try {
    const kv = (env as any).KILOWATTO_KV;
    if (!kv) return;
    const key = `brave_search_calls_${currentMonthKey()}`;
    const current = parseInt((await kv.get(key)) ?? "0", 10);
    await kv.put(key, String(current + 1));
  } catch {
    // usage counter is advisory only — never block a real search over it
  }
}

export async function getBraveUsageThisMonth(): Promise<number> {
  const kv = (env as any).KILOWATTO_KV;
  if (!kv) return 0;
  const key = `brave_search_calls_${currentMonthKey()}`;
  return parseInt((await kv.get(key)) ?? "0", 10);
}

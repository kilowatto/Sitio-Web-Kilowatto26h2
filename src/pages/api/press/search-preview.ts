import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { webSearch } from "../../../lib/web-search";
import { classifyPressCandidate } from "../../../lib/press-classify";
import { buildBraveQuery } from "../../../lib/press-query";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body: any = await request.json().catch(() => ({}));
  const include: string[] = Array.isArray(body.include) ? body.include.filter((s: any) => typeof s === "string" && s.trim()) : [];
  const exclude: string[] = Array.isArray(body.exclude) ? body.exclude.filter((s: any) => typeof s === "string" && s.trim()) : [];
  const global = !!body.global;

  if (include.length === 0) {
    return new Response(JSON.stringify({ error: "include is required" }), { status: 400 });
  }

  const query = buildBraveQuery(include, exclude);
  const results = await webSearch(query, 20, global);

  // Saved so the weekly Brave cron (press-web-search.ts) re-runs this same search until
  // Esteban deletes it from the admin panel.
  await env.DB.prepare(
    `INSERT INTO press_saved_searches (include_terms, exclude_terms, global_scope)
     VALUES (?, ?, ?)
     ON CONFLICT(include_terms, exclude_terms, global_scope) DO UPDATE SET last_run_at = datetime('now')`
  )
    .bind(JSON.stringify(include), JSON.stringify(exclude), global ? 1 : 0)
    .run();

  const items = [];
  for (const r of results) {
    if (!r.url) continue;
    const existing = await env.DB.prepare("SELECT id, status FROM press_mentions WHERE url = ?").bind(r.url).first<any>();
    if (existing) continue; // already considered before (published, pending, or rejected) — hide entirely

    const classification = await classifyPressCandidate(r.title, r.snippet);
    items.push({
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      outlet: new URL(r.url).hostname,
      aiLabel: classification.about_him,
      aiSummary: classification.summary,
    });
  }

  return new Response(JSON.stringify({ ok: true, query, items }), {
    headers: { "content-type": "application/json" },
  });
};

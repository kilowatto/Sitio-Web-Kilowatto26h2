import { env } from "cloudflare:workers";
import { stripHtml } from "./html-text";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT = "Mozilla/5.0 (compatible; KilowattoBot/1.0; +https://kilowatto.com)";

async function summarize(name: string, pageText: string): Promise<string | null> {
  if (!pageText || pageText.length < 40) return null;
  const prompt = `Este es el texto extraído de la página web real del proyecto "${name}":\n\n"""${pageText.slice(0, 6000)}"""\n\nEscribe un resumen de 1-2 oraciones en español, tono neutro y factual, describiendo qué es y qué ofrece — SOLO con base en el texto de arriba, sin inventar cifras, fechas o afirmaciones que no estén ahí. Responde SOLO el resumen, sin comillas ni prefijos.`;
  try {
    const result: any = await env.AI.run(MODEL, {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
    });
    const text = typeof result?.response === "string" ? result.response.trim() : null;
    return text || null;
  } catch {
    return null;
  }
}

// Exported as a plain function so tick.ts / the scheduled cron can call it directly
// in-process instead of self-fetching its own public URL (see runReshare() in reshare.ts
// for why nested self-fetches silently kill a Worker's own cron cadence).
export async function refreshProjects() {
  const { results: projects } = (await env.DB.prepare("SELECT * FROM projects ORDER BY sort_order").all()) as any;
  const outcomes: { id: number; name: string; ok: boolean; detail?: string }[] = [];

  for (const p of projects ?? []) {
    // Never self-fetch our own domain — a Worker calling its own public HTTPS URL rides
    // through Cloudflare's edge and is subject to the same connection-timeout failure mode
    // that used to silently kill the brand-post cron (see runReshare() in reshare.ts). Pages
    // on kilowatto.com itself are trivially "reachable" by definition; skip the network hop.
    if (/(^|\.)kilowatto\.com$/i.test(new URL(p.url).hostname)) {
      await env.DB.prepare(`UPDATE projects SET is_reachable = 1, last_checked_at = datetime('now'), last_ok_at = datetime('now') WHERE id = ?`)
        .bind(p.id)
        .run();
      outcomes.push({ id: p.id, name: p.name, ok: true });
      continue;
    }

    try {
      const res = await fetch(p.url, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const text = stripHtml(html);
      // JS-rendered apps (canvas/WebGPU demos, SPAs) serve almost no text in the raw HTML —
      // summarizing that thin scrap produces a worse, generic result than what's already
      // stored. Only replace the summary when there's enough real page text to improve on it.
      const summary = text.length >= 500 ? await summarize(p.name, text) : null;

      await env.DB.prepare(
        `UPDATE projects SET is_reachable = 1, summary = COALESCE(?, summary), last_checked_at = datetime('now'), last_ok_at = datetime('now') WHERE id = ?`
      )
        .bind(summary, p.id)
        .run();

      outcomes.push({ id: p.id, name: p.name, ok: true });
    } catch (err: any) {
      // Site down or unreachable — keep the last known-good summary, just stop showing it
      // on the site until a future run confirms it's back.
      await env.DB.prepare(`UPDATE projects SET is_reachable = 0, last_checked_at = datetime('now') WHERE id = ?`)
        .bind(p.id)
        .run();
      outcomes.push({ id: p.id, name: p.name, ok: false, detail: String(err?.message ?? err) });
    }
  }

  return { checked: outcomes.length, outcomes };
}

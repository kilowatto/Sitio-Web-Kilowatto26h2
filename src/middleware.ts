import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { BOT_SCAN_RE, ENV_SCAN_RE, LOCALE_GUESS_RE } from "./lib/bot-scan";
import { localeFromParam } from "./lib/locales";

const CACHE_KEY = "kw:entities:approved:v1";
const CACHE_TTL_SECONDS = 300;

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// This middleware runs on every HTML response, so a KV round-trip here was blocking TTFB
// on every single page load. A module-scope cache persists across requests within the same
// warm isolate, so most requests skip KV entirely instead of just skipping D1.
let memCache: { entities: any[]; expiresAt: number } | null = null;

async function getApprovedEntities() {
  const now = Date.now();
  if (memCache && memCache.expiresAt > now) return memCache.entities;

  const cached = await env.KILOWATTO_KV.get(CACHE_KEY, "json");
  if (cached) {
    memCache = { entities: cached as any[], expiresAt: now + CACHE_TTL_SECONDS * 1000 };
    return memCache.entities;
  }

  const { results } = await env.DB.prepare(
    "SELECT id, name, description, image_url, link_url, link_type, internal_path FROM entities WHERE approval_status = 'approved'"
  ).all<any>();

  const entities = results ?? [];
  await env.KILOWATTO_KV.put(CACHE_KEY, JSON.stringify(entities), { expirationTtl: CACHE_TTL_SECONDS });
  memCache = { entities, expiresAt: now + CACHE_TTL_SECONDS * 1000 };
  return entities;
}

class ScriptGuard {
  constructor(private state: { skip: boolean }) {}
  element(el: any) {
    this.state.skip = true;
    el.onEndTag(() => {
      this.state.skip = false;
    });
  }
}

class TextBuffer {
  private buffer = "";
  constructor(
    private entities: any[],
    private state: { skip: boolean }
  ) {}

  text(chunk: any) {
    if (this.state.skip) return; // inside <script>/<style> — leave untouched
    this.buffer += chunk.text;
    if (chunk.lastInTextNode) {
      const replaced = this.applyEntities(this.buffer);
      chunk.replace(replaced, { html: true });
      this.buffer = "";
    } else {
      chunk.remove();
    }
  }

  // `text` arrives as raw HTML source for this text node (HTMLRewriter does not decode
  // entities), i.e. Astro has already escaped it — a quote in the original template shows
  // up here as the literal string "&quot;". So we must NOT re-escape the buffer itself
  // (that double-encodes to "&amp;quot;"); only the strings *we* insert need escaping.
  applyEntities(text: string) {
    if (!text.trim()) return text;
    let result = text;
    for (const e of this.entities) {
      const re = new RegExp(`(?<![\\w"'>])${escapeRegExp(e.name)}(?![\\w"'<])`, "g");
      const href = e.link_type === "internal" ? e.internal_path : e.link_url;
      if (!href) continue;
      const target = e.link_type === "internal" ? "" : ' target="_blank" rel="noopener"';
      const img = e.image_url ? `<img src="${escapeAttr(e.image_url)}" alt="" loading="lazy" width="512" height="256" />` : "";
      const desc = e.description ? `<span class="kw-tt-desc">${escapeHtml(e.description)}</span>` : "";
      result = result.replace(
        re,
        `<a class="kw-tt" href="${escapeAttr(href)}"${target} data-entity="${e.id}">${escapeHtml(e.name)}<span class="kw-tt-card">${img}${desc}</span></a>`
      );
    }
    return result;
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function entityTypeOf(pathname: string): string {
  if (pathname.includes("/columnas/")) return "columna";
  if (pathname.includes("/a-fondo/")) return "investigacion";
  return "pagina";
}

// Neither GA4 nor our own log had device/browser until now -- both are free out of the
// User-Agent header, no library needed. Order matters: Edge/Opera UAs also contain
// "Chrome" and "Safari", Chrome UAs also contain "Safari", so the more specific checks
// must run first.
function parseUserAgent(ua: string): { device: string; browser: string } {
  const device = /iPad|Tablet/i.test(ua) && !/Mobile/i.test(ua)
    ? "tablet"
    : /Mobi|iPhone/i.test(ua)
      ? "mobile"
      : "desktop";

  let browser = "other";
  if (/bot|crawl|spider|slurp/i.test(ua)) browser = "bot";
  else if (/Edg\//i.test(ua)) browser = "edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "opera";
  else if (/CriOS/i.test(ua)) browser = "chrome";
  else if (/FxiOS/i.test(ua)) browser = "firefox";
  else if (/Chrome\//i.test(ua)) browser = "chrome";
  else if (/Firefox\//i.test(ua)) browser = "firefox";
  else if (/Safari\//i.test(ua)) browser = "safari";

  return { device, browser };
}

// Country/city/timezone come free on every Workers request via `request.cf` -- no external
// API, no JS beacon, no account to create. Esteban's call (2026-08-21): start collecting
// this ourselves (same Analytics Engine pattern already used for brand_posts metrics)
// rather than waiting on Google Analytics, which isn't actually wired up yet (GTM_ID is
// unset). Written fire-and-forget, best-effort -- must never affect the response.
function logPageView(context: any) {
  try {
    const pathname: string = context.url.pathname;
    const singleSegment = pathname.match(/^\/([^/]+)\/?$/)?.[1] ?? "";
    const isUnservedLocaleGuess = LOCALE_GUESS_RE.test(singleSegment) && !localeFromParam(singleSegment);
    if (
      pathname.startsWith("/admin") ||
      BOT_SCAN_RE.test(pathname) ||
      ENV_SCAN_RE.test(pathname) ||
      isUnservedLocaleGuess
    ) {
      return;
    }
    const cf: any = (context.request as any).cf ?? {};
    const acceptLanguage = context.request.headers.get("accept-language") ?? "";
    const language = acceptLanguage.split(",")[0]?.split("-")[0]?.trim().toLowerCase() || "unknown";
    const referrer = context.request.headers.get("referer") ?? "";
    let referrerHost = "";
    if (referrer) {
      try {
        referrerHost = new URL(referrer).hostname;
      } catch {
        // malformed referrer header -- leave blank
      }
    }
    const now = new Date();
    const { device, browser } = parseUserAgent(context.request.headers.get("user-agent") ?? "");

    env.PAGE_ANALYTICS?.writeDataPoint({
      blobs: [pathname, String(cf.country ?? "unknown"), language, entityTypeOf(pathname), referrerHost, device, browser],
      doubles: [now.getUTCHours()],
      indexes: [pathname],
    });
  } catch {
    // logging is best-effort, never block the response over it
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;
  if (context.url.pathname.startsWith("/admin")) return response;

  logPageView(context);

  let entities: any[] = [];
  try {
    entities = await getApprovedEntities();
  } catch {
    return response;
  }
  if (entities.length === 0) return response;

  // Single text selector only — HTMLRewriter fires content handlers once per matching
  // ancestor, so overlapping selectors like "main p, main li" (li contains h3) cause the
  // same text to be processed twice and produces mangled/double-escaped output. A separate
  // element-only guard skips <script>/<style> content so JSON-LD etc. never gets touched.
  const scriptState = { skip: false };
  const rewriter = new HTMLRewriter()
    .on("main script, main style", new ScriptGuard(scriptState) as any)
    .on("main", new TextBuffer(entities, scriptState) as any);

  return rewriter.transform(response);
});

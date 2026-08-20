import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";

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

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;
  if (context.url.pathname.startsWith("/admin")) return response;

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

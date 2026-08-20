function firstMatch(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

// Some sites (confirmed live 2026-07-23: El Universal) bake a broken/unsigned image URL into
// their own og:image meta tag (literally "?auth=undefined" — their CDN needs a real signed
// token that's normally filled in client-side and never made it into the static HTML). Reject
// those outright rather than storing a thumbnail that 403s.
function looksBroken(url: string): boolean {
  return /auth=undefined/i.test(url);
}

// Skips tiny tracking pixels and site-chrome logos — real content photos are essentially never
// 1x1 or explicitly labeled "logo".
function isLikelyContentImage(tag: string): boolean {
  if (/width=["']1["']|height=["']1["']/.test(tag)) return false;
  if (/logo/i.test(tag)) return false;
  return true;
}

// Analytics/ad beacons happily respond 200 to a HEAD request just like a real photo would
// (confirmed live 2026-07-23: a ScorecardResearch tracking pixel got accepted as a thumbnail
// this way), so urlLoads() alone can't tell them apart — reject known tracker domains and
// anything that isn't a plausible image file outright.
const TRACKER_HOSTS = /scorecardresearch\.com|doubleclick\.net|google-analytics\.com|googletagmanager\.com|googlesyndication\.com|facebook\.com\/tr|quantserve\.com|criteo\.(com|net)|taboola\.com|outbrain\.com|chartbeat\.(com|net)|newrelic\.com|hotjar\.com|adnxs\.com|adsrvr\.org|adservice\./i;

export function isPlausibleImageUrl(resolved: string): boolean {
  if (TRACKER_HOSTS.test(resolved)) return false;
  const pathname = resolved.split(/[?#]/)[0];
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(pathname) || /resizer|images?\./i.test(pathname);
}

async function urlLoads(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(6_000) });
    return res.ok;
  } catch {
    return false;
  }
}

// Recursively hunts a parsed JSON-LD value for an "image" field (string, {url}, or [string|{url}]).
// JSON-LD is populated server-side with the article's real structured data, so it's a far more
// reliable source for the true hero image than scanning generic <img> tags (which can just as
// easily pick up a shared promo banner or house ad that happens to appear before the real photo
// — confirmed live 2026-07-23 on El Universal, where the first inline <img> on every article
// page turned out to be an unrelated event banner, not the article's own photo).
function findJsonLdImage(node: any, depth = 0): string | null {
  if (!node || depth > 6) return null;
  if (typeof node === "string") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJsonLdImage(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node === "object") {
    if (typeof node.image === "string") return node.image;
    if (node.image && typeof node.image === "object") {
      if (typeof node.image.url === "string") return node.image.url;
      const nested = findJsonLdImage(node.image, depth + 1);
      if (nested) return nested;
    }
    if (Array.isArray(node.image)) {
      const first = node.image[0];
      if (typeof first === "string") return first;
      if (first?.url) return first.url;
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") {
        const found = findJsonLdImage(value, depth + 1);
        if (found) return found;
      }
    }
  }
  return null;
}

function extractJsonLdImage(html: string): string | null {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const jsonText = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "");
    try {
      const parsed = JSON.parse(jsonText);
      const image = findJsonLdImage(parsed);
      if (image) return image;
    } catch {
      // malformed JSON-LD — skip this block
    }
  }
  return null;
}

// Pulls the article's own preview image out of raw HTML, trying sources in order of reliability:
// og:image/twitter:image meta tags, then JSON-LD structured data, then finally the first
// plausible inline <img> in the body. This is what social previews use, so it's normally already
// a clean, representative thumbnail with no extra rendering needed. Every candidate is validated
// to actually load before being returned (see looksBroken()/isPlausibleImageUrl() above for why).
export async function extractThumbnail(html: string, pageUrl: string): Promise<string | null> {
  const metaCandidate = firstMatch(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ]);

  const candidates: string[] = [];
  if (metaCandidate && !looksBroken(metaCandidate)) candidates.push(metaCandidate);

  const jsonLdImage = extractJsonLdImage(html);
  if (jsonLdImage && !looksBroken(jsonLdImage)) candidates.push(jsonLdImage);

  const imgTags = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) ?? [];
  for (const tag of imgTags) {
    if (!isLikelyContentImage(tag)) continue;
    const src = tag.match(/src=["']([^"']+)["']/i)?.[1];
    if (src) candidates.push(src);
    if (candidates.length >= 5) break;
  }

  for (const raw of candidates) {
    let resolved: string;
    try {
      resolved = new URL(raw, pageUrl).toString();
    } catch {
      continue;
    }
    if (!isPlausibleImageUrl(resolved)) continue;
    if (await urlLoads(resolved)) return resolved;
  }
  return null;
}

// Naive but dependency-free HTML→text extraction, good enough for feeding page content to a
// text model or for archival snapshots — not meant to render, just to strip markup noise.
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Google News RSS <link> values are opaque redirect wrappers (news.google.com/rss/articles/...)
// that only resolve to the real article via client-side JS — a server-side fetch() just gets
// Google's own syndication shell page back, with a generic placeholder image and none of the
// real article text. This decodes the wrapper to the real destination URL using Google's own
// (undocumented, reverse-engineered) batchexecute endpoint, the same mechanism used by the
// open-source "google-news-url-decoder" projects. It's unofficial and could break if Google
// changes the internal format — always fall back gracefully, never let this block the caller.
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

function getBase64Str(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    if (url.hostname !== "news.google.com") return null;
    const segments = url.pathname.split("/");
    const kind = segments.at(-2);
    if (kind !== "articles" && kind !== "read") return null;
    return segments.at(-1) ?? null;
  } catch {
    return null;
  }
}

async function getDecodingParams(base64Str: string): Promise<{ signature: string; timestamp: string } | null> {
  for (const base of ["https://news.google.com/articles/", "https://news.google.com/rss/articles/"]) {
    try {
      const res = await fetch(base + base64Str, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const sig = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
      const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
      if (sig && ts) return { signature: sig, timestamp: ts };
    } catch {
      // try the next base URL
    }
  }
  return null;
}

async function decodeUrl(signature: string, timestamp: string, base64Str: string): Promise<string | null> {
  try {
    const innerPayload = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${base64Str}",${timestamp},"${signature}"]`;
    const body = "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", innerPayload]]]));

    const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": USER_AGENT,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Google prefixes batchexecute responses with an anti-XSSI line; the real payload
    // follows a blank line.
    const parts = text.split("\n\n");
    if (parts.length < 2) return null;
    const parsed = JSON.parse(parts[1]);
    const trimmed = parsed.slice(0, -2);
    const inner = JSON.parse(trimmed[0][2]);
    return inner[1] ?? null;
  } catch {
    return null;
  }
}

// Returns the real destination URL, or null if it couldn't be decoded (caller should fall
// back to treating the original Google News link as-is).
export async function decodeGoogleNewsUrl(sourceUrl: string): Promise<string | null> {
  const base64Str = getBase64Str(sourceUrl);
  if (!base64Str) return null;
  const params = await getDecodingParams(base64Str);
  if (!params) return null;
  return decodeUrl(params.signature, params.timestamp, base64Str);
}

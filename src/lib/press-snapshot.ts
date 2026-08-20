import { env } from "cloudflare:workers";

const USER_AGENT = "Mozilla/5.0 (compatible; KilowattoBot/1.0; +https://kilowatto.com)";

// Preserves a press mention two ways so it survives the source disappearing: our own raw
// HTML copy in R2 (guaranteed, under our control) and a best-effort public Wayback Machine
// save (external, can be slow/rate-limited, never allowed to block the mention itself).
// Pass `html` when the caller already fetched the page (e.g. for classification) to avoid a
// redundant second request; omit it to have this function fetch fresh.
export async function snapshotArticle(url: string, mentionId: number, html?: string): Promise<{ r2Key: string | null; archiveUrl: string | null }> {
  let r2Key: string | null = null;
  let archiveUrl: string | null = null;

  try {
    let body = html;
    if (!body) {
      const res = await fetch(url, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(15_000),
        redirect: "follow",
      });
      if (res.ok) body = await res.text();
    }
    if (body) {
      const key = `press-snapshots/${mentionId}.html`;
      await env.MEDIA.put(key, body, { httpMetadata: { contentType: "text/html; charset=utf-8" } });
      r2Key = key;
    }
  } catch (err) {
    console.error("Press snapshot fetch failed:", mentionId, url, err);
  }

  try {
    const saveRes = await fetch(`https://web.archive.org/save/${encodeURIComponent(url)}`, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (saveRes.ok) archiveUrl = `https://web.archive.org/web/2/${url}`;
  } catch {
    // Wayback can be slow or rate-limit us — best-effort only, our own R2 copy is the real safety net.
  }

  return { r2Key, archiveUrl };
}

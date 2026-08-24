import { env } from "cloudflare:workers";

// Counts podcast downloads from our own server, because neither directory will tell us.
//
// Apple's Podcasts Connect API is for publishing and states plainly that it gives no access to
// listening analytics. Spotify's Podcasters Analytics API needs an Analytics Reader team account
// and is reported to return empty. So the platform APIs are out.
//
// But we self-host the audio: every play from Spotify, Apple, Overcast or anywhere else fetches
// the MP3 from this Worker. That is also how the industry has always measured podcasts -- IAB
// counting is server-side download counting -- and it covers apps we never registered with, with
// no credential that can expire or be revoked.
//
// Column meanings are fixed by writeDownload() and must not be reordered:
//   blob1 entityType  blob2 entityId  blob3 locale  blob4 kind  blob5 client
//   blob6 country     blob7 listener  blob8 r2Key
//   double1 bytesServed  double2 isRange

export interface ParsedKey {
  entityType: string;
  entityId: number;
  locale: string;
  kind: "audio_narration" | "audio_dialogue";
}

// Keys are built by narrate.ts and narrate-dialogue.ts:
//   media/audio/{columna|investigacion}/{id}/{locale}/{hash}.mp3
//   media/audio/dialogo/investigacion/{id}/{locale}/{stamp}.mp3
// Anything else served by this route (video, lab samples, chunks) is not an episode and is not
// counted -- a bench sample inflating the download numbers would be worse than no numbers.
export function parseEpisodeKey(key: string): ParsedKey | null {
  let m = /^media\/audio\/dialogo\/(investigacion)\/(\d+)\/([^/]+)\//.exec(key);
  if (m) return { entityType: m[1], entityId: Number(m[2]), locale: m[3], kind: "audio_dialogue" };
  m = /^media\/audio\/(columna|investigacion)\/(\d+)\/([^/]+)\//.exec(key);
  if (m) return { entityType: m[1], entityId: Number(m[2]), locale: m[3], kind: "audio_narration" };
  return null;
}

// Coarse on purpose. The goal is "which app", not fingerprinting: podcast clients identify
// themselves clearly and everything else is lumped together.
export function clientFromUserAgent(ua: string): string {
  const u = ua.toLowerCase();
  if (u.includes("spotify")) return "Spotify";
  if (u.includes("itunes") || u.includes("applecoremedia") || u.includes("apple podcasts") || u.includes("podcasts/"))
    return "Apple Podcasts";
  if (u.includes("overcast")) return "Overcast";
  if (u.includes("pocketcasts") || u.includes("pocket casts")) return "Pocket Casts";
  if (u.includes("castbox")) return "Castbox";
  if (u.includes("amazon") || u.includes("audible")) return "Amazon";
  if (u.includes("google") || u.includes("gpodder")) return "Google";
  if (u.includes("podcastindex") || u.includes("podping") || u.includes("bot") || u.includes("crawler"))
    return "bot";
  if (u.includes("mozilla") || u.includes("safari") || u.includes("chrome")) return "navegador";
  return "otro";
}

// A stable-per-day pseudonym, never a raw IP.
//
// The IAB counting rules need to recognise repeat requests from the same listener, because one
// listen produces dozens of partial requests. That needs an identifier -- but it does not need
// to be an identity: IP and user-agent are hashed together with a secret and with the DATE, so
// the value cannot be linked across days and cannot be reversed into an address.
async function listenerHash(ip: string, ua: string): Promise<string> {
  const salt = (env as any).COMMENT_IP_SALT ?? "";
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${day}:${ip}:${ua}`));
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function writeDownload(
  key: string,
  request: Request,
  bytesServed: number,
  isRange: boolean
): Promise<void> {
  try {
    const parsed = parseEpisodeKey(key);
    if (!parsed) return;
    const dataset = (env as any).DOWNLOAD_ANALYTICS;
    if (!dataset) return;

    const ua = request.headers.get("user-agent") ?? "";
    const cf = (request as any).cf ?? {};
    const ip = request.headers.get("cf-connecting-ip") ?? "";

    dataset.writeDataPoint({
      blobs: [
        parsed.entityType,
        String(parsed.entityId),
        parsed.locale,
        parsed.kind,
        clientFromUserAgent(ua),
        String(cf.country ?? ""),
        await listenerHash(ip, ua),
        key.slice(0, 120),
      ],
      doubles: [bytesServed, isRange ? 1 : 0],
      indexes: [`${parsed.entityType}:${parsed.entityId}`],
    });
  } catch {
    // Telemetry must never take down the route that serves the audio.
  }
}

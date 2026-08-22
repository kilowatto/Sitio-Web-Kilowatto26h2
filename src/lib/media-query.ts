import { env } from "cloudflare:workers";
import type { EntityType } from "./audio-script";

export interface MediaAsset {
  id: number;
  kind: string;
  locale: string;
  r2_key: string | null;
  transcript_vtt_key: string | null;
  duration_s: number | null;
  status: string;
  cue_map_json: string | null;
}

export const SITE = "https://kilowatto.com";

// Audio is served through /media/video/[...key] -- the only route that answers Range with 206,
// which podcast players and seeking both require.
export function audioUrl(r2Key: string): string {
  return `${SITE}/media/video/${r2Key}`;
}

// schema.org wants ISO 8601, so 389 seconds is "PT6M29S", not "389" or "6:29".
export function isoDuration(seconds: number | null): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s ? `${s}S` : ""}` || "PT0S";
}

// AudioObject for the article's JSON-LD. This is what makes the narration legible to search
// engines and to answer engines that read structured data rather than rendering the page --
// without it the audio is just an <audio> tag no crawler understands as a spoken version of
// the article.
export function audioObjectJsonLd(
  asset: MediaAsset,
  opts: { name: string; description?: string | null; datePublished?: string | null; transcriptUrl?: string | null }
): Record<string, unknown> | null {
  if (!asset.r2_key) return null;
  return {
    "@type": "AudioObject",
    name: `${opts.name} (versión narrada)`,
    ...(opts.description ? { description: opts.description } : {}),
    contentUrl: audioUrl(asset.r2_key),
    encodingFormat: "audio/mpeg",
    ...(isoDuration(asset.duration_s) ? { duration: isoDuration(asset.duration_s) } : {}),
    ...(opts.datePublished ? { uploadDate: opts.datePublished } : {}),
    inLanguage: asset.locale,
    // Prefer the plain-text transcript when there is one: answer engines and crawlers read
    // prose, and VTT is cue timings wrapped around the words. The VTT stays available for
    // players via the <track> element on the player itself.
    ...(opts.transcriptUrl
      ? { transcript: { "@type": "MediaObject", contentUrl: opts.transcriptUrl, encodingFormat: "text/plain" } }
      : asset.transcript_vtt_key
        ? { transcript: { "@type": "MediaObject", contentUrl: audioUrl(asset.transcript_vtt_key), encodingFormat: "text/vtt" } }
        : {}),
    // The voice is synthetic and saying so is not optional: it is Esteban's stated editorial
    // stance, and YouTube's altered-content policy requires the disclosure wherever this
    // audio ends up.
    creditText: "Narración con voz sintética (Larry)",
    isAccessibleForFree: true,
  };
}

// Fetches the narration for one piece in one locale. Returns null unless it's actually
// playable -- a row in 'pending'/'generating'/'failed' must never render a player, or readers
// get a dead control.
export async function getAudioAsset(
  entityType: EntityType,
  entityId: number,
  locale = "es-MX"
): Promise<MediaAsset | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT id, kind, locale, r2_key, transcript_vtt_key, duration_s, status, cue_map_json
       FROM media_assets
       WHERE entity_type = ? AND entity_id = ? AND locale = ? AND kind = 'audio_narration'
         AND status = 'ready' AND r2_key IS NOT NULL`
    )
      .bind(entityType, entityId, locale)
      .first<MediaAsset>();
    return row ?? null;
  } catch {
    // The table is new; a missing table on a stale deploy shouldn't take an article page down.
    return null;
  }
}

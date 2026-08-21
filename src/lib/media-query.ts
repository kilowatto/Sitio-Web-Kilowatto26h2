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
      `SELECT id, kind, locale, r2_key, transcript_vtt_key, duration_s, status
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

import { env } from "cloudflare:workers";
import { buildAudioScript, type EntityType } from "./audio-script";
import { synthesizeScript, concatChunksToR2, alignAudio, wordsToVtt, scriptHash } from "./elevenlabs";

// End-to-end narration for one piece in one locale: adapt -> synthesize -> stitch -> align.
// Exported as a plain run*() function with a thin token-gated POST wrapper elsewhere, matching
// runGenerateBodyImages()/runGeneratePosts() so it can be called in-process from the approve
// path without a self-fetch (nested self-fetches are what caused the 522 edge timeouts that
// silently killed the brand autopilot for days).

export interface NarrateResult {
  ok: boolean;
  skipped?: string;
  audioKey?: string;
  vttKey?: string;
  durationS?: number | null;
  charactersBilled?: number;
  cachedChunks?: number;
  scriptWarnings?: string[];
  error?: string;
}

// 192 kbps CBR: bytes / (192000 / 8) = seconds. Good enough for a duration label and a
// podcast enclosure; exact framing isn't needed and would require decoding.
function estimateDurationSeconds(bytes: number): number {
  return Math.round(bytes / (192000 / 8));
}

export async function runNarrate(
  entityType: EntityType,
  entityId: number,
  locale = "es-MX",
  force = false
): Promise<NarrateResult> {
  const upsert = async (fields: Record<string, unknown>) => {
    const keys = Object.keys(fields);
    await env.DB.prepare(
      `INSERT INTO media_assets (entity_type, entity_id, locale, kind, ${keys.join(", ")}, updated_at)
       VALUES (?, ?, ?, 'audio_narration', ${keys.map(() => "?").join(", ")}, datetime('now'))
       ON CONFLICT(entity_type, entity_id, locale, kind) DO UPDATE SET
         ${keys.map((k) => `${k} = excluded.${k}`).join(", ")}, updated_at = datetime('now')`
    )
      .bind(entityType, entityId, locale, ...keys.map((k) => fields[k] as any))
      .run();
  };

  try {
    const { script, warnings } = await buildAudioScript(entityType, entityId, locale);
    if (!script.trim()) return { ok: false, error: "script vacío" };

    const hash = await scriptHash(script);

    // Idempotency: if this exact script was already narrated, don't pay for it twice. This is
    // what makes the pipeline safe to re-run on every publish and safe to retry on failure.
    if (!force) {
      const existing = await env.DB.prepare(
        `SELECT r2_key, source_hash, status FROM media_assets
         WHERE entity_type = ? AND entity_id = ? AND locale = ? AND kind = 'audio_narration'`
      )
        .bind(entityType, entityId, locale)
        .first<{ r2_key: string | null; source_hash: string | null; status: string }>();
      if (existing?.status === "ready" && existing.source_hash === hash && existing.r2_key) {
        return { ok: true, skipped: "sin cambios en el guion", audioKey: existing.r2_key };
      }
    }

    await upsert({ status: "generating", script_text: script, source_hash: hash, error: null });

    const synth = await synthesizeScript(script);
    const audioKey = `media/audio/${entityType}/${entityId}/${locale}/${hash.slice(0, 16)}.mp3`;
    const bytes = await concatChunksToR2(synth.chunks, audioKey);
    const durationS = estimateDurationSeconds(bytes);

    // Captions are a nice-to-have, not a gate: a failed alignment shouldn't block publishing
    // audio that is otherwise fine.
    let vttKey: string | null = null;
    const words = await alignAudio(audioKey, script);
    if (words && words.length > 0) {
      vttKey = `${audioKey.replace(/\.mp3$/, "")}.vtt`;
      await env.MEDIA.put(vttKey, wordsToVtt(words), {
        httpMetadata: { contentType: "text/vtt; charset=utf-8" },
      });
    }

    await upsert({
      status: "ready",
      r2_key: audioKey,
      transcript_vtt_key: vttKey,
      duration_s: durationS,
      source_hash: hash,
      script_text: script,
      error: null,
    });

    return {
      ok: true,
      audioKey,
      vttKey: vttKey ?? undefined,
      durationS,
      charactersBilled: synth.charactersBilled,
      cachedChunks: synth.cachedChunks,
      scriptWarnings: warnings,
    };
  } catch (err: any) {
    const message = String(err?.message ?? err);
    await upsert({ status: "failed", error: message.slice(0, 500) }).catch(() => {});
    return { ok: false, error: message };
  }
}

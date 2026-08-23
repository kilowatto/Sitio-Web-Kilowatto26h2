import { env } from "cloudflare:workers";
import { buildDialogueScript, HOST_NAME, COHOST_NAME } from "./dialogue-script";
import { synthesizeDialogue, type DialogueTurn } from "./elevenlabs-dialogue";
import { concatChunksToR2 } from "./elevenlabs";

// End-to-end conversational episode for one investigación in one locale.
//
// Same shape as runNarrate(): a plain run*() function with a thin token-gated POST wrapper, so
// the approve path can call it in-process instead of self-fetching (nested self-fetches are
// what caused the 522 edge timeouts that killed the brand autopilot for days).
//
// Two things it deliberately does NOT do, both of which runNarrate does:
//   - No forced alignment and no cue map. Those exist so the article page can highlight the
//     paragraph being read; a conversation does not follow the article's paragraphs, so there
//     is nothing to align it to and paying for the alignment would buy nothing.
//   - No fallback to unadapted text. There is no unadapted form of a conversation, so a
//     finding whose figures fail the guard is dropped upstream in buildDialogueScript().

// Leia's voice. Chosen by Esteban from a three-way blind comparison at the same script
// (2026-08-23); "Dani - Podcast Host", Mexican Spanish. Larry keeps ELEVENLABS_VOICE_ID, the
// same voice the columns are narrated with, so a listener who knows the columns recognises him.
const COHOST_VOICE_ID = "tMzxR2W7o3RLIY7zWBbG";

export interface DialogueNarrateResult {
  ok: boolean;
  skipped?: string;
  audioKey?: string;
  durationS?: number | null;
  beats?: number;
  charactersBilled?: number;
  cachedChunks?: number;
  scriptWarnings?: string[];
  error?: string;
}

function estimateDurationSeconds(bytes: number): number {
  return Math.round(bytes / (192000 / 8));
}

// Turns are stored as JSON so the transcript route can label who is speaking. A flattened
// string would lose that, and "who said this" is most of what a conversation transcript is for.
export function turnsToTranscript(turns: DialogueTurn[]): string {
  return turns
    .map((t) => `${t.speaker === "host" ? HOST_NAME : COHOST_NAME}: ${t.text}`)
    .join("\n\n");
}

export function parseStoredTurns(scriptText: string | null): DialogueTurn[] | null {
  if (!scriptText) return null;
  try {
    const parsed = JSON.parse(scriptText);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function runNarrateDialogue(
  entityId: number,
  locale = "es-MX",
  force = false
): Promise<DialogueNarrateResult> {
  const upsert = async (fields: Record<string, unknown>) => {
    const keys = Object.keys(fields);
    await env.DB.prepare(
      `INSERT INTO media_assets (entity_type, entity_id, locale, kind, ${keys.join(", ")}, updated_at)
       VALUES ('investigacion', ?, ?, 'audio_dialogue', ${keys.map(() => "?").join(", ")}, datetime('now'))
       ON CONFLICT(entity_type, entity_id, locale, kind) DO UPDATE SET
         ${keys.map((k) => `${k} = excluded.${k}`).join(", ")}, updated_at = datetime('now')`
    )
      .bind(entityId, locale, ...keys.map((k) => fields[k] as any))
      .run();
  };

  try {
    // Existence, not a hash of the script -- the script comes from an LLM and is not
    // deterministic, so a hash comparison never matches and every re-run re-bills everything
    // while believing it is skipping. Learned the expensive way on the narration backfill.
    if (!force) {
      const existing = await env.DB.prepare(
        `SELECT r2_key, status FROM media_assets
         WHERE entity_type = 'investigacion' AND entity_id = ? AND locale = ? AND kind = 'audio_dialogue'`
      )
        .bind(entityId, locale)
        .first<{ r2_key: string | null; status: string }>();
      if (existing?.status === "ready" && existing.r2_key) {
        return { ok: true, skipped: "ya conversado", audioKey: existing.r2_key };
      }
    }

    const built = await buildDialogueScript("investigacion", entityId, locale);
    if (built.turns.length === 0) return { ok: false, error: "guion vacío" };

    const scriptText = JSON.stringify(built.turns);
    await upsert({ status: "generating", script_text: scriptText, error: null });

    const voices = { host: String((env as any).ELEVENLABS_VOICE_ID ?? ""), cohost: COHOST_VOICE_ID };
    if (!voices.host) return { ok: false, error: "ELEVENLABS_VOICE_ID no está configurado" };

    const synth = await synthesizeDialogue(built.turns, voices, locale.startsWith("en") ? "en" : "es");
    if (synth.chunks.length === 0) return { ok: false, error: "no se produjo audio" };

    // Keyed on the character count and beat count rather than a script hash: the script is not
    // deterministic, so a hash would give every regeneration a new R2 object and orphan the old
    // one. This changes only when the episode actually changes shape.
    const stamp = `${built.beats}-${built.characters}`;
    const audioKey = `media/audio/dialogo/investigacion/${entityId}/${locale}/${stamp}.mp3`;
    const bytes = await concatChunksToR2(synth.chunks, audioKey);

    await upsert({
      status: "ready",
      r2_key: audioKey,
      duration_s: estimateDurationSeconds(bytes),
      bytes,
      script_text: scriptText,
      error: null,
    });

    return {
      ok: true,
      audioKey,
      durationS: estimateDurationSeconds(bytes),
      beats: built.beats,
      charactersBilled: synth.charactersBilled,
      cachedChunks: synth.cachedChunks,
      scriptWarnings: [...built.warnings, ...synth.warnings],
    };
  } catch (err: any) {
    const message = String(err?.message ?? err);
    await upsert({ status: "failed", error: message.slice(0, 500) }).catch(() => {});
    return { ok: false, error: message };
  }
}

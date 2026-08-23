import { env } from "cloudflare:workers";
import { buildDialogueScript, stripAllTags, HOST_NAME, COHOST_NAME } from "./dialogue-script";
import {
  synthesizeDialogue,
  synthesizeAnnouncer,
  isMonoMp3,
  STING_KEY,
  type DialogueTurn,
} from "./elevenlabs-dialogue";
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

// The announcer who reads the ident. A third voice, so the show's name does not arrive in the
// voice of one of the two people talking. "Marisol - Natural and Cordial", Mexican Spanish,
// chosen by Esteban from a five-way comparison at the same line (2026-08-23) after the first
// candidate read "VPN" with Iberian letter names.
const ANNOUNCER_VOICE_ID = "iOeCMakiJ4CctfQaM9yd";

const SHOW_NAME = "Al fondo con Kilowatto";

// Spelled out, not "1": the announcer segment is a template, so writing the word removes any
// dependence on how the synthesizer decides to normalize a digit in a title-like line.
const ORDINALS_ES = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho",
  "diecinueve", "veinte",
];
const ORDINALS_EN = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty",
];

function announcerLine(locale: string, episodeNumber: number, topic: string): string {
  const en = locale.startsWith("en");
  const words = en ? ORDINALS_EN : ORDINALS_ES;
  const n = episodeNumber <= 20 ? words[episodeNumber] : String(episodeNumber);
  return en
    ? `Deep Dive with Kilowatto. Episode ${n}. ${topic}.`
    : `${SHOW_NAME}. Episodio ${n}. ${topic}.`;
}

// The episode number is the piece's publication rank among published investigaciones, which is
// stable for an already-published piece and identical in both languages -- the same
// investigación should be episode 3 in the Spanish show and in the English one. Pinned into
// media_assets once assigned, because the announcer says it out loud.
async function resolveEpisodeNumber(entityId: number, locale: string): Promise<number> {
  const pinned = await env.DB.prepare(
    `SELECT episode_number FROM media_assets
      WHERE entity_type = 'investigacion' AND entity_id = ? AND locale = ? AND kind = 'audio_dialogue'`
  )
    .bind(entityId, locale)
    .first<{ episode_number: number | null }>();
  if (pinned?.episode_number) return pinned.episode_number;

  const rank = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM investigaciones
      WHERE status = 'published'
        AND published_at <= (SELECT published_at FROM investigaciones WHERE id = ?)`
  )
    .bind(entityId)
    .first<{ n: number }>();
  return Math.max(1, Number(rank?.n ?? 1));
}

export interface DialogueNarrateResult {
  ok: boolean;
  skipped?: string;
  audioKey?: string;
  durationS?: number | null;
  beats?: number;
  episodeNumber?: number;
  topic?: string;
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
    // Tags like [laughs] are directions for the synthesizer; on the page they are noise.
    .map((t) => `${t.speaker === "host" ? HOST_NAME : COHOST_NAME}: ${stripAllTags(t.text)}`)
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

    // The cold open is part of what was spoken, so it belongs in the stored transcript.
    const scriptText = JSON.stringify([...built.coldOpen, ...built.turns]);
    await upsert({ status: "generating", script_text: scriptText, error: null });

    const voices = { host: String((env as any).ELEVENLABS_VOICE_ID ?? ""), cohost: COHOST_VOICE_ID };
    if (!voices.host) return { ok: false, error: "ELEVENLABS_VOICE_ID no está configurado" };

    const lang = locale.startsWith("en") ? "en" : "es";
    const episodeNumber = await resolveEpisodeNumber(entityId, locale);

    // Three segments, concatenated in this order: cold open, ident, episode. The hook goes
    // BEFORE the branding -- that is what makes it a cold open, and putting the sting first
    // would spend the listener's first fifteen seconds on a logo instead of on the question
    // that makes them stay.
    const coldOpenSynth =
      built.coldOpen.length > 0
        ? await synthesizeDialogue(built.coldOpen, voices, lang)
        : { chunks: [], charactersBilled: 0, cachedChunks: 0, warnings: [] };

    const identChunks = [];
    const stingMono = await isMonoMp3(STING_KEY);
    if (stingMono === true) {
      identChunks.push({ index: 0, text: "sting", r2Key: STING_KEY, requestId: null, cached: true });
    } else if (stingMono === false) {
      // Shipping it would make every voice after it play at double speed. Better to lose the
      // music than to lose the episode.
      built.warnings.push(
        `el sting en ${STING_KEY} está en estéreo y las voces en mono; se omitió la música. ` +
          `Conviértelo offline: ffmpeg -i in.mp3 -ac 1 -ar 44100 -b:a 192k out.mp3`
      );
    } else {
      built.warnings.push(`no hay sting en ${STING_KEY}; el episodio va sin música`);
    }
    const announcerKey = await synthesizeAnnouncer(
      announcerLine(locale, episodeNumber, built.topic),
      ANNOUNCER_VOICE_ID
    );
    identChunks.push({ index: 1, text: "ident", r2Key: announcerKey, requestId: null, cached: true });

    const synth = await synthesizeDialogue(built.turns, voices, lang);
    if (synth.chunks.length === 0) return { ok: false, error: "no se produjo audio" };

    // Keyed on the character count and beat count rather than a script hash: the script is not
    // deterministic, so a hash would give every regeneration a new R2 object and orphan the old
    // one. This changes only when the episode actually changes shape.
    const stamp = `${built.beats}-${built.characters}`;
    const audioKey = `media/audio/dialogo/investigacion/${entityId}/${locale}/${stamp}.mp3`;
    const bytes = await concatChunksToR2(
      [...coldOpenSynth.chunks, ...identChunks, ...synth.chunks].map((c, i) => ({ ...c, index: i })),
      audioKey
    );

    await upsert({
      status: "ready",
      r2_key: audioKey,
      duration_s: estimateDurationSeconds(bytes),
      bytes,
      script_text: scriptText,
      episode_number: episodeNumber,
      error: null,
    });

    return {
      ok: true,
      audioKey,
      durationS: estimateDurationSeconds(bytes),
      beats: built.beats,
      episodeNumber,
      topic: built.topic,
      charactersBilled: synth.charactersBilled + coldOpenSynth.charactersBilled,
      cachedChunks: synth.cachedChunks + coldOpenSynth.cachedChunks,
      scriptWarnings: [...built.warnings, ...synth.warnings, ...coldOpenSynth.warnings],
    };
  } catch (err: any) {
    const message = String(err?.message ?? err);
    await upsert({ status: "failed", error: message.slice(0, 500) }).catch(() => {});
    return { ok: false, error: message };
  }
}

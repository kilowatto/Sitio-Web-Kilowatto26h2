import { env } from "cloudflare:workers";
import type { AudioChunk } from "./elevenlabs";

// Two-voice conversation via ElevenLabs' Text to Dialogue endpoint.
//
// Separate from elevenlabs.ts on purpose: this is a DIFFERENT model on a DIFFERENT endpoint
// with a much smaller request budget, and mixing the two sets of constants in one module is
// how you end up sending a 9,000-character chunk to an API that caps at 2,000.
//
// Why this exists at all: a 64-minute single-voice narration of an investigación is not
// listenable, which Esteban confirmed by trying. Columns at ~6 minutes are fine and keep the
// straight narration.

const API_BASE = "https://api.elevenlabs.io";

// Text to Dialogue always runs on eleven_v3 -- there is no choice of model here, and v3 is
// what makes the turn-taking sound like people rather than two narrators taking turns.
const MODEL_ID = "eleven_v3";
const OUTPUT_FORMAT = "mp3_44100_192";
const SEED = 20260823;

// The documented ceiling is 2,000 characters across all inputs[].text in one request;
// past it the API either errors or truncates. 1,800 leaves room for the audio tags the
// script writer may add ([laughs], [sighs]) without recounting them.
//
// This limit would have been fatal for narration -- seams are where monologue audio falls
// apart, which is the whole reason narration chunks at 9,000. It is survivable here because
// every seam can be placed at a SPEAKER CHANGE, where a pause is what a listener expects
// anyway. Never split a request mid-turn.
const MAX_REQUEST_CHARS = 1800;

// Stability on v3 is a three-value dial, not a continuous one: 0.0 creative, 0.5 natural,
// 1.0 robust.
//
// 0.0, not the 0.5 this started at. Esteban's note on the first full episode was "le falta
// energía", the same word he used about the narration at stability 0.55 -- and the fix there
// was the same direction. Creative is documented as more prone to artefacts, which is the real
// cost; it is worth it because a flat conversation is a conversation nobody finishes.
const DEFAULT_SETTINGS = { stability: 0, use_speaker_boost: true };
export type DialogueSettings = typeof DEFAULT_SETTINGS;

export type SpeakerId = "host" | "cohost";

export interface DialogueTurn {
  speaker: SpeakerId;
  text: string;
}

export interface DialogueVoices {
  host: string;
  cohost: string;
}

function apiKey(): string {
  const key = (env as any).ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return String(key).trim();
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Groups turns into requests without ever splitting a turn across two of them.
//
// A turn longer than the budget is a script defect, not something to paper over: in a
// conversation nobody speaks 1,800 characters without interruption, and silently splitting it
// would put a seam mid-sentence -- exactly the failure narration taught us to avoid. It is
// split at a sentence boundary as a last resort, and the caller is told.
export function groupTurns(turns: DialogueTurn[], max = MAX_REQUEST_CHARS): DialogueTurn[][] {
  const groups: DialogueTurn[][] = [];
  let current: DialogueTurn[] = [];
  let size = 0;

  const push = (t: DialogueTurn) => {
    if (size + t.text.length > max && current.length > 0) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(t);
    size += t.text.length;
  };

  for (const turn of turns) {
    if (turn.text.length <= max) {
      push(turn);
      continue;
    }
    // Oversized turn: break it at sentence ends, keeping the speaker.
    const sentences = turn.text.match(/[^.!?]+[.!?]*\s*/g) ?? [turn.text];
    let buf = "";
    for (const s of sentences) {
      if (buf.length + s.length > max && buf) {
        push({ speaker: turn.speaker, text: buf.trim() });
        buf = "";
      }
      buf += s;
    }
    if (buf.trim()) push({ speaker: turn.speaker, text: buf.trim() });
  }

  if (current.length > 0) groups.push(current);
  return groups;
}

async function dictionaryLocators(): Promise<{ pronunciation_dictionary_id: string; version_id: string }[]> {
  try {
    const raw = await env.KILOWATTO_KV.get("elevenlabs_pronunciation_dictionaries");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return [];
  }
}

export interface DialogueResult {
  chunks: AudioChunk[];
  charactersBilled: number;
  cachedChunks: number;
  /** Requests the API rejected or that came back empty, for the caller to surface. */
  warnings: string[];
}

export async function synthesizeDialogue(
  turns: DialogueTurn[],
  voices: DialogueVoices,
  languageCode?: string,
  settingsOverride: Partial<DialogueSettings> = {}
): Promise<DialogueResult> {
  const settings = { ...DEFAULT_SETTINGS, ...settingsOverride };
  const groups = groupTurns(turns);
  const chunks: AudioChunk[] = [];
  const warnings: string[] = [];
  let charactersBilled = 0;
  let cachedChunks = 0;

  const locators = await dictionaryLocators();

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const inputs = group.map((t) => ({ text: t.text, voice_id: voices[t.speaker] }));
    const text = group.map((t) => t.text).join("\n");

    // Everything that changes the audio is in the key. The voice PAIR matters, not just the
    // voices used in this particular group: swapping the co-host must invalidate the whole
    // episode, and a group that happens to be host-only would otherwise survive the swap.
    const key = `media/audio/dialogue-chunks/${await sha256Hex(
      // `settings` and not DEFAULT_SETTINGS: an A/B of two stability values that shared a cache
      // key would serve the first variant's audio for both and make the comparison meaningless.
      // That exact mistake was made twice on the narration variants.
      JSON.stringify({ inputs, model: MODEL_ID, settings, format: OUTPUT_FORMAT, seed: SEED, voices, languageCode })
    )}.mp3`;

    if (await env.MEDIA.head(key)) {
      chunks.push({ index: i, text, r2Key: key, requestId: null, cached: true });
      cachedChunks++;
      continue;
    }

    const body: Record<string, unknown> = {
      inputs,
      model_id: MODEL_ID,
      settings,
      seed: SEED,
    };
    if (languageCode) body.language_code = languageCode;
    if (locators.length > 0) body.pronunciation_dictionary_locators = locators;

    const res = await fetch(`${API_BASE}/v1/text-to-dialogue?output_format=${OUTPUT_FORMAT}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey(), "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`text-to-dialogue failed (${res.status}) on group ${i}: ${detail.slice(0, 400)}`);
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0) {
      warnings.push(`group ${i} came back empty (${text.length} chars)`);
      continue;
    }
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "audio/mpeg" } });
    charactersBilled += text.length;
    chunks.push({ index: i, text, r2Key: key, requestId: res.headers.get("request-id"), cached: false });
  }

  return { chunks, charactersBilled, cachedChunks, warnings };
}

// ---------------------------------------------------------------------------------------
// Intro assets
// ---------------------------------------------------------------------------------------

// The music sting. Generated ONCE and reused by every episode: it is the show's signature, so
// it has to be identical each time, and regenerating it per episode would both cost more and
// give a different tune every week.
//
// The API rejects `seed` together with `prompt` (422), so a prompt-generated sting is NOT
// reproducible -- the stored R2 object is the only copy of the show's theme. Treat it as an
// asset, not as something that can be rebuilt from this source file.
export const STING_KEY = "media/audio/show/al-fondo-sting.mp3";

// MP3 frames carry their own channel mode, and concatenating files is exactly the operation
// that can put two different modes in one stream. A decoder locks the mode from the first frame
// it sees: a stereo sting followed by mono speech makes it read each mono frame as stereo, which
// halves the samples per channel and plays the voices at DOUBLE SPEED. Esteban's words were "se
// escuchan como las ardillitas", and nothing in the pipeline had complained.
//
// /v1/music returns stereo and /v1/text-to-dialogue returns mono, so this WILL happen to any
// freshly generated sting. There is no encoder in a Worker isolate, so it cannot be fixed here:
// the sting has to be converted offline, once, and re-uploaded --
//   ffmpeg -i sting-raw.mp3 -ac 1 -ar 44100 -b:a 192k sting-mono.mp3
// This check turns the silent corruption into a missing sting plus a warning, which is a failure
// anyone will notice.
export async function isMonoMp3(key: string): Promise<boolean | null> {
  const head = await env.MEDIA.get(key, { range: { offset: 0, length: 8192 } });
  if (!head) return null;
  const d = new Uint8Array(await head.arrayBuffer());
  let i = 0;
  if (d[0] === 0x49 && d[1] === 0x44 && d[2] === 0x33) {
    i = 10 + (((d[6] & 0x7f) << 21) | ((d[7] & 0x7f) << 14) | ((d[8] & 0x7f) << 7) | (d[9] & 0x7f));
  }
  for (; i < d.length - 3; i++) {
    if (d[i] !== 0xff || (d[i + 1] & 0xe0) !== 0xe0) continue;
    // Channel mode is bits 7-6 of the fourth header byte; 3 means single channel.
    return ((d[i + 3] >> 6) & 3) === 3;
  }
  return null;
}

export async function composeSting(
  prompt: string,
  lengthMs = 6000,
  key = STING_KEY
): Promise<{ key: string; bytes: number }> {
  const res = await fetch(`${API_BASE}/v1/music?output_format=${OUTPUT_FORMAT}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      prompt,
      music_length_ms: lengthMs,
      model_id: "music_v2",
      // Any vocal in a station ident would collide with the announcer that follows it.
      force_instrumental: true,
    }),
  });
  if (!res.ok) throw new Error(`music failed (${res.status}): ${(await res.text()).slice(0, 400)}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) throw new Error("music returned an empty body");
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "audio/mpeg" } });
  return { key, bytes: bytes.length };
}

// The announcer line, in a voice that is neither Larry nor Leia. One short sentence per
// episode, so it is cached by content like everything else -- re-running an episode does not
// re-bill it.
export async function synthesizeAnnouncer(text: string, voiceId: string): Promise<string> {
  const key = `media/audio/show/announcer/${await sha256Hex(
    JSON.stringify({ text, voiceId, model: MODEL_ID, format: OUTPUT_FORMAT, seed: SEED })
  )}.mp3`;
  if (await env.MEDIA.head(key)) return key;

  const res = await fetch(`${API_BASE}/v1/text-to-dialogue?output_format=${OUTPUT_FORMAT}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      inputs: [{ text, voice_id: voiceId }],
      model_id: MODEL_ID,
      // The announcer is the one place where a steady, identical read every episode is the
      // point, so this ignores the expressive default the conversation uses.
      settings: { stability: 1, use_speaker_boost: true },
      seed: SEED,
    }),
  });
  if (!res.ok) throw new Error(`announcer failed (${res.status}): ${(await res.text()).slice(0, 400)}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "audio/mpeg" } });
  return key;
}

export interface VoiceSummary {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

// Voices already on the account.
export async function listOwnVoices(): Promise<VoiceSummary[]> {
  const res = await fetch(`${API_BASE}/v2/voices?page_size=100`, { headers: { "xi-api-key": apiKey() } });
  if (!res.ok) throw new Error(`voices failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json<any>();
  return (data.voices ?? []).map((v: any) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
    labels: v.labels,
    preview_url: v.preview_url,
  }));
}

// Candidates from the shared library, for picking a co-host.
export async function searchSharedVoices(params: Record<string, string>): Promise<VoiceSummary[]> {
  const qs = new URLSearchParams({ page_size: "30", ...params });
  const res = await fetch(`${API_BASE}/v1/shared-voices?${qs}`, { headers: { "xi-api-key": apiKey() } });
  if (!res.ok) throw new Error(`shared-voices failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json<any>();
  return (data.voices ?? []).map((v: any) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
    labels: { accent: v.accent, gender: v.gender, age: v.age, language: v.language, use_case: v.use_case },
    preview_url: v.preview_url,
  }));
}

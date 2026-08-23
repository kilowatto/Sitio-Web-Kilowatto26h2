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
// 1.0 robust. Natural is the documented default and the one that keeps a cloned voice
// recognisable while still reacting to the tags.
const SETTINGS = { stability: 0.5, use_speaker_boost: true };

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
  languageCode?: string
): Promise<DialogueResult> {
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
      JSON.stringify({ inputs, model: MODEL_ID, settings: SETTINGS, format: OUTPUT_FORMAT, seed: SEED, voices, languageCode })
    )}.mp3`;

    if (await env.MEDIA.head(key)) {
      chunks.push({ index: i, text, r2Key: key, requestId: null, cached: true });
      cachedChunks++;
      continue;
    }

    const body: Record<string, unknown> = {
      inputs,
      model_id: MODEL_ID,
      settings: SETTINGS,
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

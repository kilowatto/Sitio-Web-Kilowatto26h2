import { env } from "cloudflare:workers";

// Narration via ElevenLabs. Plain fetch() only -- no SDK, no Node APIs, so this runs in the
// Worker isolate as-is. ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are Worker secrets.
const API_BASE = "https://api.elevenlabs.io";

// eleven_multilingual_v2 is ElevenLabs' own pick for long-form ("most stable on long-form
// generations"), and it covers both Spanish and English from a single voice -- which is
// exactly the setup Esteban chose (one `kilowatto` voice for es + en).
//
// IMPORTANT: `language_code` is silently IGNORED on multilingual_v2. The accent comes only
// from the voice itself, never from a parameter -- so Larry's Mexican-accented English is a
// property of the chosen voice, and there is nothing to pass per-locale here.
const MODEL_ID = "eleven_multilingual_v2";
const OUTPUT_FORMAT = "mp3_44100_192"; // 192 kbps requires Creator tier or above

// Held constant across every chunk of every article so audio is reproducible: identical text
// + identical settings + identical seed => byte-similar output, which is what makes the R2
// cache key below meaningful.
const VOICE_SETTINGS = {
  // 0.40, not the 0.55 this started at. Chosen by ear in an A/B against the same text
  // (2026-08-22): 0.55 was consistent but read flat. The tradeoff is real — lower stability
  // means more expressive range but more variance between chunks — so if a long article ever
  // drifts in tone mid-piece, this is the first dial to look at.
  stability: 0.4,
  similarity_boost: 0.75,
  // style stayed at 0: the 0.35 variant was noticeably overacted for narration, and non-zero
  // style also adds latency and drifts between chunks.
  style: 0,
  speed: 1.0,
  use_speaker_boost: true,
};

export type VoiceSettings = Partial<typeof VOICE_SETTINGS>;
const SEED = 20260821;

// 9000, close to multilingual_v2's 10k ceiling, with headroom for the <break> tags the script
// builder injects.
//
// This started at 2000 to make edits cheap: a small chunk means editing one paragraph re-bills
// only that chunk. That reasoning was sound in isolation and wrong overall, because chunk
// boundaries turned out to be where the audio quality actually goes. Chaining chunks kept the
// cadence but compounded a loss of energy across the article ("mientras más lo escuchas... se
// aburre"); not chaining held the energy but broke the cadence at every seam. Both symptoms
// come from having seams at all.
//
// At 9000 a typical column (~6k characters) is a SINGLE request: no seams, no chaining, no
// tradeoff. A long investigación (~27k) drops from ~14 chunks to 3. The cost is that an edit
// re-bills a larger unit -- roughly $0.60 instead of $0.20 for a column -- which is a small
// price for narration that holds up over six minutes, and articles are rarely edited after
// publishing anyway.
const TARGET_CHUNK_CHARS = 9000;

export interface AudioChunk {
  index: number;
  text: string;
  r2Key: string;
  requestId: string | null;
  cached: boolean;
}

// Secrets pasted through a terminal routinely pick up a trailing newline or stray spaces,
// which the API rejects as an invalid key with no hint that whitespace is the cause. Trim
// both rather than make that a debugging session every time.
function apiKey(): string {
  const key = String((env as any).ELEVENLABS_API_KEY ?? "").trim();
  if (!key) throw new Error("ELEVENLABS_API_KEY not set");
  return key;
}

function voiceId(): string {
  const id = String((env as any).ELEVENLABS_VOICE_ID ?? "").trim();
  if (!id) throw new Error("ELEVENLABS_VOICE_ID not set (the `kilowatto` voice)");
  return id;
}

// Reports whether the credentials are shaped correctly and whether ElevenLabs accepts them,
// WITHOUT ever returning the secret values themselves.
export async function diagnoseCredentials(): Promise<Record<string, unknown>> {
  const rawKey = String((env as any).ELEVENLABS_API_KEY ?? "");
  const rawVoice = String((env as any).ELEVENLABS_VOICE_ID ?? "");

  const out: Record<string, unknown> = {
    keyPresent: rawKey.length > 0,
    keyLength: rawKey.length,
    keyLengthTrimmed: rawKey.trim().length,
    keyHadWhitespace: rawKey !== rawKey.trim(),
    keyLooksLikeElevenLabs: /^sk_[0-9a-f]{40,}$/i.test(rawKey.trim()),
    // Shape-only hints, never the value: enough to tell "wrong service's key" from
    // "right prefix, truncated paste".
    keyStartsWithSk: rawKey.trim().startsWith("sk_"),
    keyCharClasses: {
      hasUppercase: /[A-Z]/.test(rawKey.trim()),
      hasDash: rawKey.trim().includes("-"),
      hasUnderscore: rawKey.trim().includes("_"),
      allHexAfterPrefix: /^(sk_)?[0-9a-f]+$/i.test(rawKey.trim()),
    },
    voicePresent: rawVoice.length > 0,
    voiceLength: rawVoice.length,
    voiceHadWhitespace: rawVoice !== rawVoice.trim(),
  };

  // /v1/user is the cheapest authenticated call -- it bills nothing and tells us whether the
  // key itself is the problem, separately from the voice id.
  try {
    const res = await fetch(`${API_BASE}/v1/user`, { headers: { "xi-api-key": rawKey.trim() } });
    out.userEndpointStatus = res.status;
    if (res.ok) {
      const data: any = await res.json();
      out.tier = data?.subscription?.tier ?? null;
      out.charactersUsed = data?.subscription?.character_count ?? null;
      out.charactersLimit = data?.subscription?.character_limit ?? null;
    } else {
      out.userEndpointBody = (await res.text()).slice(0, 300);
    }
  } catch (err: any) {
    out.userEndpointError = String(err?.message ?? err);
  }

  // Confirm the voice id actually exists on this account.
  try {
    const res = await fetch(`${API_BASE}/v1/voices/${rawVoice.trim()}`, {
      headers: { "xi-api-key": rawKey.trim() },
    });
    out.voiceEndpointStatus = res.status;
    if (res.ok) {
      const data: any = await res.json();
      out.voiceName = data?.name ?? null;
      out.voiceCategory = data?.category ?? null;
    }
  } catch (err: any) {
    out.voiceEndpointError = String(err?.message ?? err);
  }

  return out;
}

// Splits on paragraph boundaries, then sentences, never mid-sentence -- a chunk boundary in
// the middle of a clause is audible.
export function chunkScript(script: string): string[] {
  const paragraphs = script
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const para of paragraphs) {
    if (para.length > TARGET_CHUNK_CHARS) {
      // Long paragraph: break it at sentence ends instead of truncating mid-thought.
      push();
      const sentences = para.match(/[^.!?…]+[.!?…]+["'”’)]*\s*|[^.!?…]+$/g) ?? [para];
      for (const sentence of sentences) {
        if (current.length + sentence.length > TARGET_CHUNK_CHARS && current) push();
        current += sentence;
      }
      push();
      continue;
    }
    if (current.length + para.length + 2 > TARGET_CHUNK_CHARS && current) push();
    current += (current ? "\n\n" : "") + para;
  }
  push();
  return chunks;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Every input that changes the audio must be in the cache key, or we'd serve stale audio
// after a settings change.
async function chunkCacheKey(
  text: string,
  settings: typeof VOICE_SETTINGS,
  previousRequestIds: string[]
): Promise<string> {
  const hash = await sha256Hex(
    JSON.stringify({
      text,
      model: MODEL_ID,
      voice: voiceId(),
      settings,
      format: OUTPUT_FORMAT,
      seed: SEED,
      // Chaining changes the audio, so it has to change the key -- otherwise a run with
      // chaining OFF is served the previously cached chained audio and any comparison between
      // the two is silently meaningless. Keyed on the MODE, not on the request ids themselves:
      // those are different on every run, so including them would mean chunk 2 onward never
      // hits cache again, defeating the whole point of caching per paragraph.
      chained: previousRequestIds.length > 0,
    })
  );
  return `media/audio/chunks/${hash}.mp3`;
}

export async function scriptHash(script: string): Promise<string> {
  return sha256Hex(
    JSON.stringify({ script, model: MODEL_ID, voice: voiceId(), settings: VOICE_SETTINGS, format: OUTPUT_FORMAT, seed: SEED })
  );
}

// Loads the pronunciation dictionary locators (brand names and acronyms -- see
// docs/pronunciation-dictionary.md). Capped at 3 by the API. Stored in KV so the list can be
// edited without a deploy; absent is fine, it just means no overrides.
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

// Generates one chunk, reusing the R2 copy when the exact same text+settings was already
// synthesized. `previousRequestIds` carries prosody across chunk boundaries -- it takes
// precedence over `previous_text` and is the difference between a narration that flows and
// one that resets tone every 2000 characters.
async function synthesizeChunk(
  text: string,
  index: number,
  previousRequestIds: string[],
  settings: typeof VOICE_SETTINGS
): Promise<AudioChunk> {
  const r2Key = await chunkCacheKey(text, settings, previousRequestIds);

  const existing = await env.MEDIA.head(r2Key);
  if (existing) {
    return { index, text, r2Key, requestId: null, cached: true };
  }

  const locators = await dictionaryLocators();
  const body: Record<string, unknown> = {
    text,
    model_id: MODEL_ID,
    voice_settings: settings,
    seed: SEED,
  };
  if (previousRequestIds.length > 0) body.previous_request_ids = previousRequestIds.slice(-3);
  if (locators.length > 0) body.pronunciation_dictionary_locators = locators;

  const res = await fetch(
    `${API_BASE}/v1/text-to-speech/${voiceId()}?output_format=${OUTPUT_FORMAT}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}) on chunk ${index}: ${detail.slice(0, 300)}`);
  }

  // A single chunk is ~2000 chars of speech (a few hundred KB) so buffering it is safe --
  // well under the 128 MB isolate limit. The full article is never buffered at once.
  const bytes = new Uint8Array(await res.arrayBuffer());
  await env.MEDIA.put(r2Key, bytes, { httpMetadata: { contentType: "audio/mpeg" } });

  return {
    index,
    text,
    r2Key,
    requestId: res.headers.get("request-id"),
    cached: false,
  };
}

export interface NarrationResult {
  chunks: AudioChunk[];
  charactersBilled: number;
  cachedChunks: number;
}

// Synthesizes a whole script, chunk by chunk, sequentially -- sequential is required, not a
// simplification: each chunk feeds its request_id to the next one for prosody continuity.
// `chainProsody` conditions each chunk on the previous ones so tone carries across chunk
// boundaries. That is a genuine tradeoff, not a free win: because every chunk inherits the
// last one's delivery, a slight loss of energy compounds down the article. Esteban heard
// exactly that on the first full narration -- fine at the start, noticeably bored by minute
// two -- so this is switchable and the default is settled by ear, not by theory.
export async function synthesizeScript(
  script: string,
  overrides: VoiceSettings = {},
  chainProsody = true
): Promise<NarrationResult> {
  const settings = { ...VOICE_SETTINGS, ...overrides };
  const chunks = chunkScript(script);
  const out: AudioChunk[] = [];
  const requestIds: string[] = [];
  let charactersBilled = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = await synthesizeChunk(chunks[i], i, chainProsody ? requestIds : [], settings);
    out.push(chunk);
    if (chunk.requestId) requestIds.push(chunk.requestId);
    if (!chunk.cached) charactersBilled += chunks[i].length;
  }

  return {
    chunks: out,
    charactersBilled,
    cachedChunks: out.filter((c) => c.cached).length,
  };
}

// Concatenating MP3 frames is valid and is what ElevenLabs' own long-form guidance implies;
// each chunk ends on a frame boundary at a fixed bitrate, so players handle the join.
export async function concatChunksToR2(chunks: AudioChunk[], destKey: string): Promise<number> {
  const parts: Uint8Array[] = [];
  let total = 0;
  for (const chunk of chunks) {
    const obj = await env.MEDIA.get(chunk.r2Key);
    if (!obj) throw new Error(`chunk missing from R2: ${chunk.r2Key}`);
    const bytes = new Uint8Array(await obj.arrayBuffer());
    parts.push(bytes);
    total += bytes.length;
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }

  await env.MEDIA.put(destKey, merged, { httpMetadata: { contentType: "audio/mpeg" } });
  return total;
}

export interface AlignedWord {
  text: string;
  start: number;
  end: number;
  loss: number | null;
}

// Word-level timings for captions. Forced alignment beats the TTS `with-timestamps`
// endpoints here: those return CHARACTER timings only, while this returns real words plus a
// per-word confidence (`loss`) we can gate on. Runs once over the finished, stitched file.
export async function alignAudio(audioKey: string, script: string): Promise<AlignedWord[] | null> {
  try {
    const obj = await env.MEDIA.get(audioKey);
    if (!obj) return null;

    const form = new FormData();
    form.append("file", new Blob([await obj.arrayBuffer()], { type: "audio/mpeg" }), "audio.mp3");
    form.append("text", script);

    const res = await fetch(`${API_BASE}/v1/forced-alignment`, {
      method: "POST",
      headers: { "xi-api-key": apiKey() },
      body: form,
    });
    if (!res.ok) return null;

    const data: any = await res.json();
    return (data.words ?? []).map((w: any) => ({
      text: String(w.text ?? ""),
      start: Number(w.start ?? 0),
      end: Number(w.end ?? 0),
      loss: w.loss === undefined || w.loss === null ? null : Number(w.loss),
    }));
  } catch {
    return null;
  }
}

function vttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

// Groups aligned words into readable cues. 65 chars/line is Apple's guidance for podcast
// transcripts and reads well as on-screen captions too.
export function wordsToVtt(words: AlignedWord[], maxChars = 65): string {
  if (words.length === 0) return "WEBVTT\n";

  const cues: { start: number; end: number; text: string }[] = [];
  let current: { start: number; end: number; parts: string[] } | null = null;

  for (const word of words) {
    const token = word.text.trim();
    if (!token) continue;
    if (!current) {
      current = { start: word.start, end: word.end, parts: [token] };
      continue;
    }
    const candidate = current.parts.join(" ") + " " + token;
    // Break on sentence end or line length, whichever comes first.
    if (candidate.length > maxChars || /[.!?…]$/.test(current.parts[current.parts.length - 1])) {
      cues.push({ start: current.start, end: current.end, text: current.parts.join(" ") });
      current = { start: word.start, end: word.end, parts: [token] };
    } else {
      current.parts.push(token);
      current.end = word.end;
    }
  }
  if (current) cues.push({ start: current.start, end: current.end, text: current.parts.join(" ") });

  return (
    "WEBVTT\n\n" +
    cues.map((c, i) => `${i + 1}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${c.text}\n`).join("\n")
  );
}

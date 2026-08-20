import { env } from "cloudflare:workers";
import { retrieveVoiceExamples } from "./photo-voice-learning";

// Internal "AI captioning failed" placeholder — never render this to a public visitor.
// Exported so every page that falls back to ai_caption (galeria.astro, [locale]/galeria.astro)
// checks against the exact same string instead of duplicating the literal.
export const CAPTION_FAILURE_SENTINEL = "(no se pudo analizar automáticamente — revisar manualmente)";

const VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";
// Llama 3.2 Vision has meaningfully better world knowledge (landmark recognition, general
// scene understanding) than llava-1.5-7b — confirmed live 2026-07-20 — but the safety/
// solo-subject calls below are already tuned and working, so only the new descriptive/
// landmark/orange calls use it. No sense re-validating a safety-critical path for a change
// that isn't needed there.
const DESCRIPTIVE_VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Split into two separate calls — a combined "caption + MINOR: field" single-prompt
// approach turned out unreliable in practice: live testing (2026-07-20) showed the model
// very often just writes the caption sentence and stops, never emitting the second
// "MINOR:" line at all (not "unsure" — simply absent), which made every photo flag
// regardless of content. A single, focused yes/no/unsure question gets a real answer.
const CAPTION_PROMPT = "Describe esta foto en una sola oración breve en español, como caption de galería.";
const SAFETY_PROMPT =
  "Responde con SOLO una palabra, sin explicación: yes si aparece alguna persona que parezca ser menor de 18 años en esta imagen, " +
  "no si estás seguro de que todas las personas son adultas, o unsure si no estás seguro.";
const SOLO_PROMPT =
  "Esta foto ¿tiene a una sola persona como protagonista claro y foco de la imagen? Cuenta como YES aunque haya una audiencia, público, u otras " +
  "personas borrosas o lejanas de fondo — lo que importa es si hay UN protagonista en primer plano/foco (ej: alguien dando un discurso en un podio " +
  "cuenta como YES aunque se vea gente detrás o abajo). Responde NO solo si hay dos o más personas igual de prominentes en primer plano compartiendo el foco. " +
  "Responde con SOLO una palabra: yes o no.";

// DISABLED — confirmed live 2026-07-20 that this hallucinates the SAME wrong landmark
// ("Sagrada Familia") across at least 11 completely unrelated photos (an airplane cabin, a
// corporate award ceremony, a Senate floor, a New Year's party — none in Barcelona, several
// with no location data at all), regardless of the "only answer with high confidence, say
// ninguno otherwise" instruction. A follow-up mitigation that cross-checked the claim
// against the photo's real GPS-derived city caught it when a city was known, but every one
// of the 11 confirmed hallucinations had no known city to check against, so the model's own
// "confidence" is worthless here — not a prompt-wording problem, a model-reliability one.
// Kept for reference in case a different/future vision model is worth trying against this
// exact prompt, but never called below.
const LANDMARK_PROMPT =
  "¿Reconoces con ALTA confianza un monumento, edificio o lugar famoso ESPECÍFICO en esta imagen (ej: Torre Eiffel, Tower Bridge, Times Square, " +
  "Sagrada Familia)? Si tienes alta confianza, responde SOLO el nombre del lugar en español. Si no reconoces ninguno específico o no estás " +
  "completamente seguro, responde SOLO la palabra: ninguno.";
const ORANGE_PROMPT =
  "¿La persona principal de esta foto trae puesta ropa, calzado o accesorio de color NARANJA (playera, chamarra, gorra, tenis, mochila, etc.)? " +
  "Responde con SOLO una palabra: yes o no.";
const DESCRIPTIVE_PROMPT =
  "Describe objetivamente en 1-2 oraciones lo que ves en esta foto: la escena, el entorno/lugar aparente, y qué hace la persona principal si hay " +
  "una. Solo hechos observables, sin opiniones ni estilo literario.";

// Independent of the model's own answer — the 2026-07-19 incident showed the model can
// describe a minor in the caption sentence itself even when its safety answer says "no".
// Any of these words anywhere in the CAPTION forces flagged, regardless of the safety call.
const MINOR_KEYWORDS =
  /\b(niñ[oa]s?|beb[eé]s?|infante|menor(?:es)?\s+de\s+edad|menor(?:es)?\b|adolescentes?|joven(?:cit[oa])?|ni[nñ]it[oa]s?|kids?|child(?:ren)?|toddlers?|infants?|teens?|minors?)\b/i;

// Takes the already-converted image array (see captionAndFlag) rather than converting
// bytes → number[] itself — that conversion is the expensive part (a real phone photo's
// few MB becomes millions of individual JS numbers), and doing it once per photo instead
// of once per vision call is what keeps this under the Worker's memory limit. Confirmed
// live 2026-07-20: six concurrent Array.from(bytes) calls on real photos hit "Worker
// exceeded memory limit" — this was the actual cause, not the six model calls themselves.
async function runVision(imageArray: number[], prompt: string, maxTokens: number, model = VISION_MODEL): Promise<string | null> {
  try {
    const result: any = await env.AI.run(model, {
      image: imageArray,
      prompt,
      max_tokens: maxTokens,
    });
    return (result.description ?? result.response ?? "").trim();
  } catch (err) {
    console.error(`Vision model error (prompt="${prompt.slice(0, 30)}..."):`, err);
    return null;
  }
}

async function callText(prompt: string, maxTokens: number): Promise<string | null> {
  try {
    const result: any = await env.AI.run(TEXT_MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens });
    return typeof result?.response === "string" ? result.response.trim() : null;
  } catch (err) {
    console.error("Text model error:", err);
    return null;
  }
}

export async function captionAndFlag(
  bytes: Uint8Array,
  knownCity?: string | null
): Promise<{
  caption: string;
  minorFlag: "clear" | "flagged";
  soloSubject: boolean;
  wearingOrange: boolean;
  sceneDescription: string;
}> {
  // Fully sequential, one vision call at a time — confirmed live 2026-07-20 that even two
  // concurrent groups of 3 still hit "Worker exceeded memory limit" on real ~2.5MB photos.
  // Each env.AI.run() crossing the Workers AI binding boundary appears to copy the image
  // array again internally, so N concurrent calls means N copies in flight at once — only
  // strictly sequential calls keep peak memory to roughly one copy, regardless of image
  // size. Converting bytes → array once and reusing the reference still avoids re-paying
  // the JS-side conversion cost per call.
  const imageArray = Array.from(bytes);
  const captionResult = await runVision(imageArray, CAPTION_PROMPT, 100);
  const safetyResult = await runVision(imageArray, SAFETY_PROMPT, 10);
  const soloResult = await runVision(imageArray, SOLO_PROMPT, 10);
  const orangeResult = await runVision(imageArray, ORANGE_PROMPT, 10, DESCRIPTIVE_VISION_MODEL);
  const descriptiveResult = await runVision(imageArray, DESCRIPTIVE_PROMPT, 120, DESCRIPTIVE_VISION_MODEL);

  if (captionResult === null && safetyResult === null) {
    // Both calls failed outright (e.g. "Request is too large") — fail closed, but say why
    // instead of silently flagging with no explanation.
    return {
      caption: CAPTION_FAILURE_SENTINEL,
      minorFlag: "flagged",
      soloSubject: false,
      wearingOrange: false,
      sceneDescription: "",
    };
  }

  const literalCaption = captionResult ?? "(sin descripción — falló el análisis automático)";
  const safetyAnswer = safetyResult?.toLowerCase().match(/\b(yes|no|unsure)\b/)?.[1];
  const modelSaysClear = safetyAnswer === "no";
  const captionMentionsMinor = MINOR_KEYWORDS.test(literalCaption);
  // The model sometimes answers in Spanish ("sí") despite the yes/no instruction wording —
  // same class of bug as the MINOR field being missed entirely. Accept both.
  const soloSubject = soloResult?.toLowerCase().match(/\b(yes|s[ií])\b/) != null;
  const wearingOrange = orangeResult?.toLowerCase().match(/\b(yes|s[ií])\b/) != null;
  // Landmark auto-detection is disabled entirely (see LANDMARK_PROMPT's comment) — always
  // null. knownCity (the real GPS-derived city, when we have one) is still used below by
  // stylizeCaption, since that's actual data, not an AI guess.
  const landmark: string | null = null;
  const sceneDescription = descriptiveResult ?? literalCaption;

  // A failed/ambiguous safety call is treated the same as "unsure" — fail closed.
  const minorFlag = modelSaysClear && !captionMentionsMinor ? "clear" : "flagged";

  const styledCaption = minorFlag === "flagged" ? literalCaption : await stylizeCaption(sceneDescription, landmark, wearingOrange);

  return {
    caption: styledCaption ?? literalCaption,
    minorFlag,
    soloSubject,
    wearingOrange,
    sceneDescription,
  };
}

// Esteban's own words for the tone: "serio no solemne, irónico, haciendo burla de mí mismo
// sin insultar". Orange clothing gets a varied callback line (never the same phrasing twice
// in a row would require tracking recent phrasings — out of scope for now, so this just asks
// for variety per-call) when detected; a landmark is named only when the vision call was
// confident enough to produce one at all (see LANDMARK_PROMPT's fail-safe "ninguno" design).
async function stylizeCaption(sceneDescription: string, landmark: string | null, wearingOrange: boolean): Promise<string | null> {
  const voiceExamples = await retrieveVoiceExamples(sceneDescription);

  const prompt = `Escribe un caption de galería de fotos en español, en primera... no, en tercera persona sobre Esteban Rey ("Kilowatto"), a partir de esta descripción objetiva de la foto:
"${sceneDescription}"
${landmark ? `Lugar reconocido con confianza: ${landmark}.` : ""}

Tono de Esteban (imítalo, no un tono genérico): serio pero no solemne, irónico, se burla de sí mismo sin insultarse — nunca cursi, nunca "influencer".
${voiceExamples ? `\n${voiceExamples}\n` : ""}
${wearingOrange ? 'Esteban trae puesto algo de color naranja en esta foto — menciónalo con una frase tipo firma personal, variando la forma (ej. "con sus típicos tenis naranjas", "no podía faltar su playera naranja", "siempre de naranja") — no uses siempre la misma frase exacta.' : ""}
${landmark ? `Menciona el lugar (${landmark}) de forma natural, no como ficha de wikipedia.` : "No inventes ni menciones ningún monumento o lugar específico — solo la escena general."}

Una sola oración breve (máximo ~25 palabras), sin comillas, sin emojis. Responde SOLO el caption final.`;

  return callText(prompt, 100);
}

const CITY_CLEANUP_CACHE = new Map<string, string>();

// Confirmed live 2026-07-31: on a short max_tokens=20 generation, the 70B model occasionally
// degenerates into token-repetition/mixed-script garbage (e.g. "000000|000000|...ари") instead
// of failing outright — nothing downstream ever checked the shape of what came back before this,
// so garbage got persisted to photos.taken_city and even cached, poisoning every other photo
// from the same trip within the same Worker isolate. A short, mostly-Latin-script, printable
// string that shares some content with the raw input is a normal city name; anything else is
// rejected and the raw geocoded name is used instead.
function isPlausibleCityName(candidate: string, rawCity: string): boolean {
  if (!candidate || candidate.length > 48) return false;
  if (/[\u0000-\u001f\ufffd]/.test(candidate)) return false; // control chars / replacement char
  if (!/^[\p{L}\p{M}\p{N}\s.,'()-]+$/u.test(candidate)) return false;
  const rawWords = rawCity.toLowerCase().match(/[\p{L}]{3,}/gu) ?? [];
  const candidateLower = candidate.toLowerCase();
  const sharesWord = rawWords.length === 0 || rawWords.some((w) => candidateLower.includes(w));
  return sharesWord;
}

// Nominatim returns formal administrative names ("Greater London", "Ciudad de México,
// CDMX") — this asks for the natural, short name a person would actually say ("Londres").
// Cached in-memory per Worker instance since the same raw name repeats constantly across a
// batch upload from the same trip. Only validated results are cached/returned — a rejected
// (garbage) generation falls back to the raw geocoded name instead of poisoning the cache.
export async function cleanCityName(rawCity: string): Promise<string> {
  if (!rawCity.trim()) return rawCity;
  if (CITY_CLEANUP_CACHE.has(rawCity)) return CITY_CLEANUP_CACHE.get(rawCity)!;

  const prompt = `Convierte este nombre de lugar (de una API de geocodificación) al nombre corto y natural en español que una persona usaría al hablar, sin perder el lugar real (ej. "Greater London" → "Londres", "Ciudad de México" → "Ciudad de México", "Département de Paris" → "París"). Responde SOLO el nombre corto, sin explicación:\n\n"${rawCity}"`;
  const cleaned = await callText(prompt, 20);
  const result = cleaned && isPlausibleCityName(cleaned, rawCity) ? cleaned : rawCity;
  CITY_CLEANUP_CACHE.set(rawCity, result);
  return result;
}

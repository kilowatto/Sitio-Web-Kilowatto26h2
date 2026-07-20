import { env } from "cloudflare:workers";

const VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";

// Split into two separate calls — a combined "caption + MINOR: field" single-prompt
// approach turned out unreliable in practice: live testing (2026-07-20) showed the model
// very often just writes the caption sentence and stops, never emitting the second
// "MINOR:" line at all (not "unsure" — simply absent), which made every photo flag
// regardless of content. A single, focused yes/no/unsure question gets a real answer.
const CAPTION_PROMPT = "Describe esta foto en una sola oración breve en español, como caption de galería.";
const SAFETY_PROMPT =
  "Responde con SOLO una palabra, sin explicación: yes si aparece alguna persona que parezca ser menor de 18 años en esta imagen, " +
  "no si estás seguro de que todas las personas son adultas, o unsure si no estás seguro.";

// Independent of the model's own answer — the 2026-07-19 incident showed the model can
// describe a minor in the caption sentence itself even when its safety answer says "no".
// Any of these words anywhere in the CAPTION forces flagged, regardless of the safety call.
const MINOR_KEYWORDS =
  /\b(niñ[oa]s?|beb[eé]s?|infante|menor(?:es)?\s+de\s+edad|menor(?:es)?\b|adolescentes?|joven(?:cit[oa])?|ni[nñ]it[oa]s?|kids?|child(?:ren)?|toddlers?|infants?|teens?|minors?)\b/i;

async function runVision(bytes: Uint8Array, prompt: string, maxTokens: number): Promise<string | null> {
  try {
    const result: any = await env.AI.run(VISION_MODEL, {
      image: Array.from(bytes),
      prompt,
      max_tokens: maxTokens,
    });
    return (result.description ?? result.response ?? "").trim();
  } catch (err) {
    console.error(`Vision model error (prompt="${prompt.slice(0, 30)}..."):`, err);
    return null;
  }
}

export async function captionAndFlag(bytes: Uint8Array): Promise<{ caption: string; minorFlag: "clear" | "flagged" }> {
  const [captionResult, safetyResult] = await Promise.all([
    runVision(bytes, CAPTION_PROMPT, 100),
    runVision(bytes, SAFETY_PROMPT, 10),
  ]);

  if (captionResult === null && safetyResult === null) {
    // Both calls failed outright (e.g. "Request is too large") — fail closed, but say why
    // instead of silently flagging with no explanation.
    return { caption: "(no se pudo analizar automáticamente — revisar manualmente)", minorFlag: "flagged" };
  }

  const caption = captionResult ?? "(sin descripción — falló el análisis automático)";
  const safetyAnswer = safetyResult?.toLowerCase().match(/\b(yes|no|unsure)\b/)?.[1];
  const modelSaysClear = safetyAnswer === "no";
  const captionMentionsMinor = MINOR_KEYWORDS.test(caption);

  // A failed/ambiguous safety call is treated the same as "unsure" — fail closed.
  const minorFlag = modelSaysClear && !captionMentionsMinor ? "clear" : "flagged";
  return { caption, minorFlag };
}

import { env } from "cloudflare:workers";

const VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";

const VISION_PROMPT =
  "Describe esta foto en una sola oración breve en español, como caption de galería. " +
  "Luego en una segunda línea escribe exactamente MINOR: yes si aparece alguna persona que parezca ser menor de 18 años, " +
  "MINOR: unsure si no estás seguro, o MINOR: no si estás seguro de que no hay ningún menor.";

// Safety net independent of the model following the MINOR: field format — the 2026-07-19
// incident showed the model sometimes describes a minor in the caption sentence itself
// (e.g. "que parece ser menor de 18 años") without a clean MINOR: line, which regex-only
// parsing of the field missed. Any of these words anywhere in the raw model output forces
// "flagged", no matter what the MINOR: line says.
const MINOR_KEYWORDS =
  /\b(niñ[oa]s?|beb[eé]s?|infante|menor(?:es)?\s+de\s+edad|menor(?:es)?\b|adolescentes?|joven(?:cit[oa])?|ni[nñ]it[oa]s?|kids?|child(?:ren)?|toddlers?|infants?|teens?|minors?)\b/i;

export async function captionAndFlag(bytes: Uint8Array): Promise<{ caption: string; minorFlag: "clear" | "flagged" }> {
  try {
    const result: any = await env.AI.run(VISION_MODEL, {
      image: Array.from(bytes),
      prompt: VISION_PROMPT,
      max_tokens: 200,
    });
    const text: string = result.description ?? result.response ?? "";
    const minorMatch = text.match(/MINOR:\s*(yes|no|unsure)/i);
    const minorAnswer = minorMatch?.[1]?.toLowerCase();
    const fieldSaysClear = minorAnswer === "no";
    const captionMentionsMinor = MINOR_KEYWORDS.test(text);
    const minorFlag = fieldSaysClear && !captionMentionsMinor ? "clear" : "flagged";
    const caption = text.replace(/MINOR:\s*(yes|no|unsure)/i, "").trim();
    return { caption, minorFlag };
  } catch (err) {
    console.error("Vision model error:", err);
    return { caption: "", minorFlag: "flagged" };
  }
}

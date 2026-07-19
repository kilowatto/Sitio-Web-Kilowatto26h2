import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";

const VISION_PROMPT =
  "Describe esta foto en una sola oración breve en español, como caption de galería. " +
  "Luego en una segunda línea escribe exactamente MINOR: yes si aparece alguna persona que parezca ser menor de 18 años, " +
  "MINOR: unsure si no estás seguro, o MINOR: no si estás seguro de que no hay ningún menor.";

// Safety net independent of the model following the MINOR: field format — the 2026-07-19
// incident showed the model sometimes describes a minor in the caption sentence itself
// (e.g. "que parece ser menor de 18 años") without a clean MINOR: line, which the old
// regex-only parsing missed. Any of these words anywhere in the raw model output forces
// "flagged", no matter what the MINOR: line says.
const MINOR_KEYWORDS =
  /\b(niñ[oa]s?|beb[eé]s?|infante|menor(?:es)?\s+de\s+edad|menor(?:es)?\b|adolescentes?|joven(?:cit[oa])?|ni[nñ]it[oa]s?|kids?|child(?:ren)?|toddlers?|infants?|teens?|minors?)\b/i;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json<{
    r2_key: string;
    album?: string;
    taken_date?: string;
    taken_city?: string;
  }>();

  if (!body?.r2_key) {
    return new Response(JSON.stringify({ error: "missing r2_key" }), { status: 400 });
  }

  const object = await env.MEDIA.get(body.r2_key);
  if (!object) {
    return new Response(JSON.stringify({ error: "object not found in R2" }), { status: 404 });
  }

  const bytes = new Uint8Array(await object.arrayBuffer());

  let aiCaption = "";
  let minorFlag: "pending" | "clear" | "flagged" = "flagged"; // fail closed by default

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
    // Both signals must agree it's clear — either one saying "possible minor" wins.
    minorFlag = fieldSaysClear && !captionMentionsMinor ? "clear" : "flagged";
    aiCaption = text.replace(/MINOR:\s*(yes|no|unsure)/i, "").trim();
  } catch (err) {
    console.error("Vision model error:", err);
    aiCaption = "";
    minorFlag = "flagged";
  }

  await env.DB.prepare(
    `INSERT INTO photos (r2_key, ai_caption, album, taken_date, taken_city, minor_flag, approval_status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`
  )
    .bind(body.r2_key, aiCaption, body.album ?? null, body.taken_date ?? null, body.taken_city ?? null, minorFlag)
    .run();

  return new Response(JSON.stringify({ ok: true, ai_caption: aiCaption, minor_flag: minorFlag }), {
    headers: { "content-type": "application/json" },
  });
};

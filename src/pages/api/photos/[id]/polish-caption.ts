import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { NON_CANONICAL_LOCALES, VOICE_INSTRUCTIONS } from "../../../../lib/locales";
import { recordCaptionCorrection } from "../../../../lib/photo-voice-learning";

export const prerender = false;

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

async function callAI(prompt: string, maxTokens: number): Promise<string | null> {
  const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens });
  if (typeof result?.response === "string") return result.response.trim();
  if (result?.response && typeof result.response === "object") return JSON.stringify(result.response);
  return null;
}

// Parses inline "@Name" mentions (single-token names, e.g. "@Rocío") out of a caption and
// auto-tags them the same way the manual tag-input does — insert-if-new, then link. Lets
// Esteban tag people while writing instead of switching to the separate name field.
async function tagMentionedPeople(photoId: string, text: string) {
  const names = [...text.matchAll(/@([\wÀ-ÿ]+)/gu)].map((m) => m[1]);
  for (const name of [...new Set(names)]) {
    await env.DB.prepare("INSERT INTO people (name) VALUES (?) ON CONFLICT(name) DO NOTHING").bind(name).run();
    const person = await env.DB.prepare("SELECT id FROM people WHERE name = ? COLLATE NOCASE").bind(name).first<any>();
    if (person) {
      await env.DB.prepare("INSERT INTO photo_people (photo_id, person_id) VALUES (?, ?) ON CONFLICT DO NOTHING")
        .bind(photoId, person.id)
        .run();
    }
  }
}

// Esteban writes/edits a caption in Spanish (pre-filled with the AI's own draft from
// ingest); this polishes the spelling/grammar/style (keeping the meaning, not rewriting the
// content) and translates the polished version into the other 11 locales via the same
// translations table every other page already reads. Also feeds the before/after into the
// photo-caption voice RAG (src/lib/photo-voice-learning.ts) so future AI-drafted captions
// learn Esteban's real tone over time, and auto-tags any "@Name" mentions in the text.
export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const authToken = url.searchParams.get("token");
  if (authToken !== env.ADMIN_TOKEN && authToken !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json<{ caption: string }>();
  const raw = body?.caption?.trim();
  if (!raw) return new Response(JSON.stringify({ error: "falta caption" }), { status: 400 });

  const current = await env.DB.prepare("SELECT ai_caption FROM photos WHERE id = ?").bind(params.id).first<any>();

  const polishPrompt = `Corrige y redacta este texto en español (caption de una foto personal) con ortografía y redacción perfectas, tono natural y cercano — NO cambies el significado, NO agregues información nueva, solo corrige y pule la forma. Los "@Nombre" son etiquetas de personas, consérvalos tal cual, no los traduzcas ni los quites. Responde SOLO el texto corregido, sin comillas ni explicación:\n\n"${raw}"`;
  const polished = (await callAI(polishPrompt, 200)) ?? raw;

  await env.DB.prepare("UPDATE photos SET caption = ? WHERE id = ?").bind(polished, params.id).run();
  await tagMentionedPeople(params.id!, polished);
  if (current?.ai_caption) await recordCaptionCorrection(current.ai_caption, polished);

  const translations: Record<string, string> = {};
  for (const locale of NON_CANONICAL_LOCALES) {
    const voice = VOICE_INSTRUCTIONS[locale.code] ?? `Translate to ${locale.code}.`;
    const prompt = `${voice}\n\nTraduce este caption de foto personal (español) — responde SOLO la traducción, sin comillas ni explicación. Los "@Nombre" son etiquetas de personas, consérvalos EXACTAMENTE igual (no los traduzcas, ni siquiera si la palabra después de @ también es una palabra común del idioma de origen):\n\n"${polished}"`;
    const translated = await callAI(prompt, 200);
    if (translated) {
      translations[locale.code] = translated;
      await env.DB.prepare(
        `INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
         VALUES ('photos', ?, ?, 'caption', ?, 'ai', 0)
         ON CONFLICT(entity_type, entity_id, locale, field_key)
         DO UPDATE SET value = excluded.value, source = 'ai', reviewed = 0, updated_at = datetime('now')`
      )
        .bind(params.id, locale.code, translated)
        .run();
    }
  }

  return new Response(JSON.stringify({ ok: true, polished, translations }), {
    headers: { "content-type": "application/json" },
  });
};

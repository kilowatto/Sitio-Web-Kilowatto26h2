import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { NON_CANONICAL_LOCALES, VOICE_INSTRUCTIONS } from "../../../../lib/locales";

export const prerender = false;

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

async function callAI(prompt: string, maxTokens: number): Promise<string | null> {
  const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens });
  if (typeof result?.response === "string") return result.response.trim();
  if (result?.response && typeof result.response === "object") return JSON.stringify(result.response);
  return null;
}

// Esteban writes a rough caption in Spanish; this polishes the spelling/grammar/style
// (keeping the meaning, not rewriting the content) and translates the polished version
// into the other 11 locales via the same translations table every other page already reads.
export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json<{ caption: string }>();
  const raw = body?.caption?.trim();
  if (!raw) return new Response(JSON.stringify({ error: "falta caption" }), { status: 400 });

  const polishPrompt = `Corrige y redacta este texto en español (caption de una foto personal) con ortografía y redacción perfectas, tono natural y cercano — NO cambies el significado, NO agregues información nueva, solo corrige y pule la forma. Responde SOLO el texto corregido, sin comillas ni explicación:\n\n"${raw}"`;
  const polished = (await callAI(polishPrompt, 200)) ?? raw;

  await env.DB.prepare("UPDATE photos SET caption = ? WHERE id = ?").bind(polished, params.id).run();

  const translations: Record<string, string> = {};
  for (const locale of NON_CANONICAL_LOCALES) {
    const voice = VOICE_INSTRUCTIONS[locale.code] ?? `Translate to ${locale.code}.`;
    const prompt = `${voice}\n\nTraduce este caption de foto personal (español) — responde SOLO la traducción, sin comillas ni explicación:\n\n"${polished}"`;
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

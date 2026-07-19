import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { VOICE_INSTRUCTIONS, localeFromParam } from "../../lib/locales";

export const prerender = false;

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const FIELD_MAP: Record<string, string[]> = {
  profile: ["bio_short"],
  companies: ["role", "summary"],
  investments: ["summary"],
  timeline_events: ["title", "description"],
  family_members: ["relationship", "bio"],
};

async function translateFields(locale: string, fields: Record<string, string | null>) {
  const nonEmpty = Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null && v !== ""));
  if (Object.keys(nonEmpty).length === 0) return {};

  const voice = VOICE_INSTRUCTIONS[locale] ?? `Translate to ${locale}.`;
  const prompt = `${voice}\n\nTraduce cada valor de este objeto JSON (los textos están en español mexicano, sobre la biografía profesional de un empresario tecnológico llamado Esteban Rey / Kilowatto). Devuelve SOLO un objeto JSON con las mismas llaves y los valores traducidos, sin texto adicional, sin markdown:\n\n${JSON.stringify(nonEmpty)}`;

  let result: any;
  try {
    result = await env.AI.run(MODEL, {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
    });
  } catch (err) {
    console.error("Translate AI call failed:", err);
    return {};
  }

  // Some Workers AI responses come back with `.response` already parsed as an object
  // when the model output looks like JSON — handle both shapes defensively.
  if (result?.response && typeof result.response === "object") {
    return result.response;
  }

  const raw: string = typeof result?.response === "string" ? result.response : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {};
  }
}

async function upsert(entityType: string, entityId: number, locale: string, translated: Record<string, string>) {
  for (const [field, value] of Object.entries(translated)) {
    if (!value) continue;
    await env.DB.prepare(
      `INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
       VALUES (?, ?, ?, ?, ?, 'ai', 0)
       ON CONFLICT(entity_type, entity_id, locale, field_key)
       DO UPDATE SET value = excluded.value, source = 'ai', reviewed = 0, updated_at = datetime('now')`
    )
      .bind(entityType, entityId, locale, field, value)
      .run();
  }
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const localeParam = url.searchParams.get("locale") ?? "";
  const locale = localeFromParam(localeParam);
  if (!locale || locale.canonical) {
    return new Response(JSON.stringify({ error: "invalid or canonical locale" }), { status: 400 });
  }

  const summary: Record<string, number> = {};

  try {
    for (const [table, fields] of Object.entries(FIELD_MAP)) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all<any>();
      let count = 0;
      await Promise.all(
        (results ?? []).map(async (row: any) => {
          const toTranslate: Record<string, string | null> = {};
          for (const f of fields) toTranslate[f] = row[f];
          const translated = await translateFields(locale.code, toTranslate);
          if (Object.keys(translated).length > 0) {
            await upsert(table, row.id, locale.code, translated);
            count++;
          }
        })
      );
      summary[table] = count;
    }
  } catch (err: any) {
    console.error("Translate endpoint error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, locale: locale.code, summary }), {
    headers: { "content-type": "application/json" },
  });
};

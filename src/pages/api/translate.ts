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
  quotes: ["text"],
  projects: ["role", "summary"],
};

async function translateFields(locale: string, fields: Record<string, string | null>) {
  const nonEmpty = Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null && v !== ""));
  if (Object.keys(nonEmpty).length === 0) return {};

  const voice = VOICE_INSTRUCTIONS[locale] ?? `Translate to ${locale}.`;
  const prompt = `${voice}\n\nTraduce cada valor de este objeto JSON (los textos están en español mexicano, sobre la biografía profesional de un empresario tecnológico llamado Esteban Rey / Kilowatto). NUNCA traduzcas nombres propios de personas, empresas, marcas o productos (ej. "Esteban Rey", "Kilowatto", "Ignia Cloud", "Cereza", "Aluna", "DeSiCi", "Yucatech Festival", "Orange Rhino Investments") — déjalos exactamente igual, tal cual aparecen, incluso si la palabra también existe como sustantivo común en español. Devuelve SOLO un objeto JSON con las mismas llaves y los valores traducidos, sin texto adicional, sin markdown:\n\n${JSON.stringify(nonEmpty)}`;

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

// Columns have an HTML body (<h2>/<p>/<ul> blocks, occasionally an opaque interactive widget) —
// the generic FIELD_MAP path below sends whole field values straight to the LLM as opaque
// strings, which is fine for plain text but would let the model reflow/drop/mangle markup if
// pointed at raw HTML. Instead: split body_html into blocks, translate only the bare text of
// each (plus title/subtitle), then reassemble the HTML shell ourselves so tag structure is
// guaranteed unchanged regardless of what the model does to the text.
//
// <ul> was NOT handled until 2026-07-28 — confirmed live that every bullet list in a translated
// column silently vanished (matchAll on a h2|p-only pattern skips right over <ul> entirely, and
// the reconstruction only ever emits matched blocks) — e.g. the English "Padrón del Desastre"
// had 1 <li> on the page vs 8 in the Spanish original. Fixed by parsing <ul> as its own block
// type and translating each <li> as its own section, same reliability approach as h2/p.
type ColumnBlock =
  | { type: "h2" | "p"; tag: string; text: string }
  | { type: "ul"; items: string[] }
  | { type: "opaque"; html: string };

// Interactive widgets (e.g. the scroll-triggered bar chart) carry only version labels/numbers in
// their data attributes — not prose — so they're extracted before block-splitting and passed
// through untouched rather than routed through translation, where there'd be nothing meaningful
// to translate and real risk of the model mangling the markup.
const OPAQUE_RE = /<div class="scroll-bar-chart"[\s\S]*?<\/div>/g;

function decodeEntities(s: string): string {
  return s.replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseColumnBlocks(bodyHtml: string): ColumnBlock[] {
  const opaques: string[] = [];
  const withPlaceholders = bodyHtml.replace(OPAQUE_RE, (m) => {
    opaques.push(m);
    return `@@@OPAQUE_${opaques.length - 1}@@@`;
  });

  const blocks: ColumnBlock[] = [];
  // Capture the exact opening tag (group 1/3) so attributes like class="column-callout" survive
  // the round-trip instead of being silently reset to a bare <p> on reconstruction.
  const re = /(<h2>)([\s\S]*?)<\/h2>|<ul>([\s\S]*?)<\/ul>|(<p[^>]*>)([\s\S]*?)<\/p>|@@@OPAQUE_(\d+)@@@/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withPlaceholders))) {
    if (m[1] !== undefined) blocks.push({ type: "h2", tag: m[1], text: decodeEntities(m[2]) });
    else if (m[3] !== undefined) {
      const items = Array.from(m[3].matchAll(/<li>([\s\S]*?)<\/li>/g)).map((li) => decodeEntities(li[1]));
      blocks.push({ type: "ul", items });
    } else if (m[4] !== undefined) blocks.push({ type: "p", tag: m[4], text: decodeEntities(m[5]) });
    else if (m[6] !== undefined) blocks.push({ type: "opaque", html: opaques[Number(m[6])] });
  }
  return blocks;
}

// Delimiter-based format instead of JSON — confirmed live 2026-07-27: asking the model for a
// JSON array of ~30 paragraph strings reliably broke on locales whose translated text happened
// to contain an unescaped quote/apostrophe (en, pt-BR, ar all failed JSON.parse the same way).
// A plain "marker line, then text" format has nothing to escape, so it survives regardless of
// what punctuation the translated text contains.
const SECTION_MARKER = "@@@KILOWATTO_SECTION@@@";

async function translateColumn(locale: string, row: any): Promise<Record<string, string>> {
  const blocks = parseColumnBlocks(row.body_html);

  // Flatten to one translatable string per section: h2/p contribute one each, ul contributes
  // one per <li>, opaque blocks contribute none (they're reinserted verbatim afterward).
  const bodyTexts: string[] = [];
  for (const b of blocks) {
    if (b.type === "h2" || b.type === "p") bodyTexts.push(b.text);
    else if (b.type === "ul") bodyTexts.push(...b.items);
  }

  const sections = [row.title ?? "", row.subtitle ?? "", ...bodyTexts];
  const inputText = sections.map((s, i) => `${SECTION_MARKER}${i}\n${s}`).join("\n");

  const voice = VOICE_INSTRUCTIONS[locale] ?? `Translate to ${locale}.`;
  const prompt = `${voice}\n\nTraduce cada sección de este texto — es una columna de opinión sobre tecnología escrita por Esteban Rey (Kilowatto). El texto está dividido en secciones marcadas con líneas "${SECTION_MARKER}<número>" — la sección 0 es el título, la sección 1 es el subtítulo, y el resto son los párrafos/encabezados del cuerpo en orden. Devuelve EXACTAMENTE el mismo número de secciones, con las mismas líneas marcadoras "${SECTION_MARKER}<número>" intactas en el mismo orden, cada sección traducida debajo de su marcador. NUNCA traduzcas nombres propios de personas, empresas, marcas o modelos de IA (ej. "Esteban Rey", "Kilowatto", "Fable", "Sonnet 5", "Opus 4.8", "GPT", "Sol", "Kimi K3", "GitLab", "MySQL") — déjalos exactamente igual. No agregues texto adicional, explicaciones, ni markdown — SOLO las secciones marcadas:\n\n${inputText}`;

  let result: any;
  try {
    result = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 4096 });
  } catch (err) {
    console.error(`Translate column AI call failed (locale ${locale}):`, err);
    return {};
  }

  const raw: string = typeof result?.response === "string" ? result.response : JSON.stringify(result?.response ?? "");
  const parts = raw.split(new RegExp(`${SECTION_MARKER}\\d+\\n?`));
  // split() on a leading-marker regex leaves an empty string before the first match — drop it.
  const translatedSections = parts.slice(1).map((s) => s.trim());

  if (translatedSections.length !== sections.length) {
    console.error(
      `Translate column: section count mismatch (${translatedSections.length} vs ${sections.length}) for locale ${locale}, raw length ${raw.length}`
    );
    return {};
  }

  const [translatedTitle, translatedSubtitle, ...translatedBodyTexts] = translatedSections;

  let cursor = 0;
  const htmlParts: string[] = [];
  for (const b of blocks) {
    if (b.type === "h2" || b.type === "p") {
      const text = translatedBodyTexts[cursor] ?? b.text;
      cursor++;
      const closeTag = b.type === "h2" ? "h2" : "p";
      htmlParts.push(`${b.tag}${escapeHtml(text)}</${closeTag}>`);
    } else if (b.type === "ul") {
      const items = b.items.map((original) => {
        const text = translatedBodyTexts[cursor] ?? original;
        cursor++;
        return `<li>${escapeHtml(text)}</li>`;
      });
      htmlParts.push(`<ul>\n${items.join("\n")}\n</ul>`);
    } else {
      htmlParts.push(b.html);
    }
  }
  const bodyHtml = htmlParts.join("\n");

  return { title: translatedTitle || row.title, subtitle: translatedSubtitle || row.subtitle || "", body_html: bodyHtml };
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
  const tok = url.searchParams.get("token");
  if (tok !== env.ADMIN_TOKEN && tok !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  // Optional: translate ONE column instead of the whole site.
  //
  // Without this the only way to fill a single gap is to re-run everything, which regenerates
  // every existing translation. That matters beyond wasted work: the narrated audio and its
  // paragraph cue map are built against a specific translated text, so silently replacing that
  // text would leave the audio saying one thing while the page shows another, and the
  // highlight matching nothing.
  const onlyColumnId = url.searchParams.get("columnId")
    ? Number(url.searchParams.get("columnId"))
    : null;

  const localeParam = url.searchParams.get("locale") ?? "";
  const locale = localeFromParam(localeParam);
  if (!locale || locale.canonical) {
    return new Response(JSON.stringify({ error: "invalid or canonical locale" }), { status: 400 });
  }

  const summary: Record<string, number> = {};

  try {
    // A targeted run touches only the requested column; the generic tables are skipped.
    for (const [table, fields] of Object.entries(onlyColumnId ? {} : FIELD_MAP)) {
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

    // "columns" isn't in FIELD_MAP — its body_html needs the block-preserving path above,
    // not the generic whole-string translation loop.
    const { results: columnRows } = onlyColumnId
      ? await env.DB.prepare("SELECT * FROM columns WHERE id = ?").bind(onlyColumnId).all<any>()
      : await env.DB.prepare("SELECT * FROM columns").all<any>();
    // A handful of columns have a real human-written version in a given locale (e.g. Esteban's
    // own English draft of a column he also wrote in Spanish) — those were inserted directly
    // with source='human'. Never let this endpoint re-run and clobber them with an AI
    // retranslation; skip any column+locale that already has a human row for either field.
    const { results: humanRows } = await env.DB.prepare(
      "SELECT entity_id FROM translations WHERE entity_type = 'columns' AND locale = ? AND source = 'human'"
    )
      .bind(locale.code)
      .all<any>();
    const humanIds = new Set((humanRows ?? []).map((r: any) => r.entity_id));
    let columnCount = 0;
    await Promise.all(
      (columnRows ?? [])
        .filter((row: any) => !humanIds.has(row.id))
        .map(async (row: any) => {
        const translated = await translateColumn(locale.code, row);
        if (Object.keys(translated).length > 0) {
          await upsert("columns", row.id, locale.code, translated);
          columnCount++;
        }
      })
    );
    summary.columns = columnCount;
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

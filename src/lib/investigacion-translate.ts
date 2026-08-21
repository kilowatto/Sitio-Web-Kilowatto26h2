// Investigación-aware translation, mirroring translate.ts's translateColumn() but handling
// markup columns never had to deal with: inline citation links (<a class="cite...">), chart
// placeholders (<!--chart:key-->), and body-content images (<figure class="ia-inline-img...">).
// All three must survive translation completely untouched -- citation labels are almost always
// institution/publication names that shouldn't be translated anyway, and mangling a chart
// placeholder or an image figure would silently break the rendered page.
import { VOICE_INSTRUCTIONS } from "./locales";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const SECTION_MARKER = "@@@KILOWATTO_SECTION@@@";

async function callAI(env: any, prompt: string, maxTokens: number): Promise<string> {
  try {
    const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens });
    return typeof result?.response === "string" ? result.response : JSON.stringify(result?.response ?? "");
  } catch (err) {
    console.error("investigacion-translate AI call failed:", err);
    return "";
  }
}

function decodeEntities(s: string): string {
  return s.replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const CITE_RE = /<a class="cite cite--(?:green|yellow|red)"[\s\S]*?<\/a>/g;

// Protects citation anchors inside a paragraph's text before it goes to the model -- the
// citation label (an institution/publication name) should never be translated, and the model
// has no reason to see or touch the raw <a> markup at all.
function protectCitations(text: string): { protected: string; cites: string[] } {
  const cites: string[] = [];
  const protectedText = text.replace(CITE_RE, (m) => {
    cites.push(m);
    return `@@@CITE_${cites.length - 1}@@@`;
  });
  return { protected: protectedText, cites };
}
function restoreCitations(text: string, cites: string[]): string {
  return text.replace(/@@@CITE_(\d+)@@@/g, (_all, n) => cites[Number(n)] ?? "");
}

type Block =
  | { type: "h2"; tag: string; text: string; cites: string[] }
  | { type: "p"; tag: string; text: string; cites: string[] }
  | { type: "opaque"; html: string };

const BLOCK_RE = /(<h2[^>]*>)([\s\S]*?)<\/h2>|(<p[^>]*>)([\s\S]*?)<\/p>|(<!--chart:[a-z0-9-]+-->)|(<figure class="ia-inline-img[\s\S]*?<\/figure>)/g;

function parseInvestigacionBlocks(bodyHtml: string): Block[] {
  const blocks: Block[] = [];
  let m: RegExpExecArray | null;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(bodyHtml))) {
    if (m[1] !== undefined) {
      const { protected: text, cites } = protectCitations(decodeEntities(m[2]));
      blocks.push({ type: "h2", tag: m[1], text, cites });
    } else if (m[3] !== undefined) {
      const raw = m[4];
      // The sign-off block (Esteban Rey / X / LinkedIn / Wikidata) is proper nouns and URLs --
      // nothing in it should ever be translated.
      if (raw.includes("wikidata.org/wiki/Q140672978")) {
        blocks.push({ type: "opaque", html: m[3] + raw + "</p>" });
      } else {
        const { protected: text, cites } = protectCitations(decodeEntities(raw));
        blocks.push({ type: "p", tag: m[3], text, cites });
      }
    } else if (m[5] !== undefined) {
      blocks.push({ type: "opaque", html: m[5] });
    } else if (m[6] !== undefined) {
      blocks.push({ type: "opaque", html: m[6] });
    }
  }
  return blocks;
}

export interface InvestigacionTranslatable {
  title: string;
  subtitle: string | null;
  hook: string | null;
  summary: string;
  body_html: string;
  methodology_html: string | null;
}

export async function translateInvestigacionFields(
  env: any,
  locale: string,
  row: InvestigacionTranslatable
): Promise<Record<string, string>> {
  const blocks = parseInvestigacionBlocks(row.body_html);
  const bodyTexts: string[] = [];
  for (const b of blocks) {
    if (b.type === "h2" || b.type === "p") bodyTexts.push(b.text);
  }

  const methodologyBlocks = row.methodology_html ? parseInvestigacionBlocks(row.methodology_html) : [];
  const methodologyTexts: string[] = [];
  for (const b of methodologyBlocks) {
    if (b.type === "h2" || b.type === "p") methodologyTexts.push(b.text);
  }

  const sections = [row.title, row.subtitle ?? "", row.hook ?? "", row.summary, ...bodyTexts, ...methodologyTexts];
  const inputText = sections.map((s, i) => `${SECTION_MARKER}${i}\n${s}`).join("\n");

  const voice = VOICE_INSTRUCTIONS[locale] ?? `Translate to ${locale}.`;
  const prompt = `${voice}\n\nTraduce cada sección de este texto -- es una investigación periodística de A Fondo con Kilowatto, escrita por Esteban Rey. El texto está dividido en secciones marcadas con líneas "${SECTION_MARKER}<número>": 0=título, 1=subtítulo, 2=gancho/hook, 3=resumen ejecutivo, y el resto son los encabezados/párrafos del cuerpo y luego de la metodología, en orden. Puede haber tokens literales "@@@CITE_<número>@@@" dentro del texto -- son marcadores de citas y DEBEN aparecer EXACTAMENTE igual, en la misma posición relativa, en tu traducción; nunca los traduzcas ni los elimines. Devuelve EXACTAMENTE el mismo número de secciones, con las mismas líneas marcadoras intactas, cada sección traducida debajo de su marcador. NUNCA traduzcas nombres propios de personas, empresas, instituciones, marcas o productos -- déjalos exactamente igual. No agregues texto adicional ni markdown -- SOLO las secciones marcadas:\n\n${inputText}`;

  const raw = await callAI(env, prompt, 8000);
  const parts = raw.split(new RegExp(`${SECTION_MARKER}\\d+\\n?`));
  const translated = parts.slice(1).map((s) => s.trim());

  if (translated.length !== sections.length) {
    console.error(`translateInvestigacionFields: section count mismatch (${translated.length} vs ${sections.length}) for locale ${locale}`);
    return {};
  }

  const [title, subtitle, hook, summary, ...rest] = translated;
  const bodyTranslated = rest.slice(0, bodyTexts.length);
  const methodologyTranslated = rest.slice(bodyTexts.length, bodyTexts.length + methodologyTexts.length);

  // escapeHtml() must run BEFORE citations are restored -- it would otherwise re-escape the
  // raw <a class="cite..."> markup right back into text. Escaping the model's translated
  // prose first, then splicing the untouched citation HTML back in, keeps both intact.
  function reassembleFixed(blockList: Block[], translatedTexts: string[]): string {
    let cursor = 0;
    const parts: string[] = [];
    for (const b of blockList) {
      if (b.type === "opaque") {
        parts.push(b.html);
        continue;
      }
      const rawText = translatedTexts[cursor] ?? b.text;
      cursor++;
      const escaped = escapeHtml(rawText);
      const withCites = restoreCitations(escaped, b.cites);
      parts.push(`${b.tag}${withCites}</${b.type}>`);
    }
    return parts.join("\n");
  }
  return {
    title: title || row.title,
    subtitle: subtitle || row.subtitle || "",
    hook: hook || row.hook || "",
    summary: summary || row.summary,
    body_html: reassembleFixed(blocks, bodyTranslated),
    methodology_html: row.methodology_html ? reassembleFixed(methodologyBlocks, methodologyTranslated) : "",
  };
}

// Generic recursive string-leaf translator for chart data_json -- every chart type (bar, radar,
// table, timeline, donut, etc.) keeps numbers as real JSON numbers and only ever puts
// translatable text in string leaves, so walking any shape generically (rather than writing a
// parser per chart type) is both simpler and automatically correct for all 13 types.
function collectStrings(node: any, out: string[]): void {
  if (typeof node === "string") {
    if (node.trim()) out.push(node);
  } else if (Array.isArray(node)) {
    for (const v of node) collectStrings(v, out);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) collectStrings(v, out);
  }
}
function rebuildWithStrings(node: any, pool: string[], cursor: { i: number }): any {
  if (typeof node === "string") {
    if (!node.trim()) return node;
    return pool[cursor.i++] ?? node;
  }
  if (Array.isArray(node)) return node.map((v) => rebuildWithStrings(v, pool, cursor));
  if (node && typeof node === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(node)) out[k] = rebuildWithStrings(v, pool, cursor);
    return out;
  }
  return node;
}

export interface ChartTranslatable {
  chartKey: string;
  title: string;
  description: string | null;
  sourceNote: string | null;
  data: any;
}

// One AI call per locale for ALL of a piece's charts combined, to keep the per-locale step
// count (and AI call count across 11 locales) manageable rather than one call per chart.
export async function translateInvestigacionCharts(
  env: any,
  locale: string,
  charts: ChartTranslatable[]
): Promise<Record<string, { title: string; description: string | null; sourceNote: string | null; data: any }>> {
  if (charts.length === 0) return {};

  const perChartStrings: string[][] = charts.map((c) => {
    const strs: string[] = [c.title, c.description ?? "", c.sourceNote ?? ""];
    collectStrings(c.data, strs);
    return strs;
  });
  const flatSections = perChartStrings.flat();
  const inputText = flatSections.map((s, i) => `${SECTION_MARKER}${i}\n${s}`).join("\n");

  const voice = VOICE_INSTRUCTIONS[locale] ?? `Translate to ${locale}.`;
  const prompt = `${voice}\n\nTraduce cada sección de este texto -- son títulos, descripciones y etiquetas de texto (ejes, series, encabezados de tabla, etc.) de gráficas de datos dentro de una investigación de A Fondo con Kilowatto. Los números y cifras no aparecen aquí (ya se excluyeron), solo texto. El texto está dividido en secciones marcadas con líneas "${SECTION_MARKER}<número>". Devuelve EXACTAMENTE el mismo número de secciones, en el mismo orden, con las mismas líneas marcadoras intactas. Si una sección está vacía, devuélvela vacía debajo de su marcador. NUNCA traduzcas nombres propios de personas, empresas, instituciones, países o productos -- déjalos exactamente igual. No agregues texto adicional ni markdown -- SOLO las secciones marcadas:\n\n${inputText}`;

  const raw = await callAI(env, prompt, 8000);
  const parts = raw.split(new RegExp(`${SECTION_MARKER}\\d+\\n?`));
  const translatedFlat = parts.slice(1).map((s) => s.trim());

  if (translatedFlat.length !== flatSections.length) {
    console.error(`translateInvestigacionCharts: section count mismatch (${translatedFlat.length} vs ${flatSections.length}) for locale ${locale}`);
    return {};
  }

  const result: Record<string, { title: string; description: string | null; sourceNote: string | null; data: any }> = {};
  let offset = 0;
  for (let i = 0; i < charts.length; i++) {
    const c = charts[i];
    const n = perChartStrings[i].length;
    const slice = translatedFlat.slice(offset, offset + n);
    offset += n;
    const [title, description, sourceNote, ...dataStrings] = slice;
    const cursor = { i: 0 };
    const data = rebuildWithStrings(c.data, dataStrings, cursor);
    result[c.chartKey] = {
      title: title || c.title,
      description: description || c.description,
      sourceNote: sourceNote || c.sourceNote,
      data,
    };
  }
  return result;
}

export async function upsertInvestigacionTranslation(env: any, investigacionId: number, locale: string, fieldKey: string, value: string) {
  if (!value) return;
  await env.DB.prepare(
    `INSERT INTO translations (entity_type, entity_id, locale, field_key, value, source, reviewed)
     VALUES ('investigaciones', ?, ?, ?, ?, 'ai', 0)
     ON CONFLICT(entity_type, entity_id, locale, field_key)
     DO UPDATE SET value = excluded.value, source = 'ai', reviewed = 0, updated_at = datetime('now')`
  )
    .bind(investigacionId, locale, fieldKey, value)
    .run();
}

// Full per-locale translation of one investigación: fields+body, then all its charts, then
// persisted to the shared `translations` EAV table (entity_type='investigaciones'). Charts use
// a "chart:{chartKey}:{field}" field_key convention so they share the same table/entity_id
// instead of needing a schema change.
export async function translateInvestigacion(
  env: any,
  locale: string,
  investigacionId: number
): Promise<{ ok: boolean; chartsTranslated: number }> {
  const row = await env.DB.prepare("SELECT * FROM investigaciones WHERE id = ?").bind(investigacionId).first<any>();
  if (!row) return { ok: false, chartsTranslated: 0 };

  const fields = await translateInvestigacionFields(env, locale, row);
  if (Object.keys(fields).length > 0) {
    for (const [key, value] of Object.entries(fields)) {
      await upsertInvestigacionTranslation(env, investigacionId, locale, key, value);
    }
  }

  const chartsRes = await env.DB.prepare(
    "SELECT chart_key, title, description, source_note, data_json FROM investigacion_charts WHERE investigacion_id = ?"
  )
    .bind(investigacionId)
    .all<any>();
  const charts: ChartTranslatable[] = (chartsRes.results ?? []).map((c: any) => ({
    chartKey: c.chart_key,
    title: c.title,
    description: c.description,
    sourceNote: c.source_note,
    data: JSON.parse(c.data_json),
  }));

  const translatedCharts = await translateInvestigacionCharts(env, locale, charts);
  let chartsTranslated = 0;
  for (const [chartKey, t] of Object.entries(translatedCharts)) {
    await upsertInvestigacionTranslation(env, investigacionId, locale, `chart:${chartKey}:title`, t.title);
    if (t.description) await upsertInvestigacionTranslation(env, investigacionId, locale, `chart:${chartKey}:description`, t.description);
    if (t.sourceNote) await upsertInvestigacionTranslation(env, investigacionId, locale, `chart:${chartKey}:source_note`, t.sourceNote);
    await upsertInvestigacionTranslation(env, investigacionId, locale, `chart:${chartKey}:data_json`, JSON.stringify(t.data));
    chartsTranslated++;
  }

  return { ok: Object.keys(fields).length > 0, chartsTranslated };
}

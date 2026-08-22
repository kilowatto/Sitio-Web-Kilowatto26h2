import { env } from "cloudflare:workers";

// Turns a published article into a script meant to be HEARD rather than read. Esteban chose
// an adapted script over literal reading (2026-08-21): article prose leans on things that
// don't survive being spoken -- bulleted lists, tables, "como muestra la gráfica", inline
// links, parenthetical citations.
//
// EDITORIAL RULE, enforced in code and not merely documented: the model may rewrite WORDING,
// never NUMBERS. Chart figures are rendered deterministically from investigacion_charts.data_json
// (see describeChart) and every adapted section is checked against the source for invented
// numbers (see findInventedNumbers). This matters because measured chart-reading accuracy for
// frontier models is poor -- the ChartHal benchmark puts GPT-5 at ~34% -- so no model output
// is trusted with a figure a reader could quote.
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export type EntityType = "columna" | "investigacion";

async function llm(prompt: string, maxTokens = 2048): Promise<string> {
  const result: any = await env.AI.run(MODEL, {
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
  });
  return String(result?.response ?? "").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      // A link's text is what matters aloud; the URL never is.
      .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

interface ChartRow {
  chart_key: string;
  chart_type: string;
  title: string | null;
  description: string | null;
  data_json: string | null;
  source_note: string | null;
}

// Renders a chart as prose WITHOUT any model involvement. Every number here comes straight
// out of the stored, human-verified data_json. Deliberately conservative: it names the
// extremes and the count rather than trying to narrate every series, because a spoken list
// of twelve values is useless to a listener anyway.
function describeChart(chart: ChartRow): string {
  const title = chart.title?.trim() || "los datos";
  if (!chart.data_json) return `Sobre ${title}, los detalles están en la gráfica del artículo.`;

  let parsed: any;
  try {
    parsed = JSON.parse(chart.data_json);
  } catch {
    return `Sobre ${title}, los detalles están en la gráfica del artículo.`;
  }

  // The chart components accept several shapes; pull out anything that looks like
  // {label, value} pairs and ignore the rest rather than guessing.
  const rows: { label: string; value: number }[] = [];
  const candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : [];
  for (const item of candidates) {
    if (!item || typeof item !== "object") continue;
    const label = item.label ?? item.name ?? item.category ?? item.key;
    const value = item.value ?? item.y ?? item.count ?? item.amount;
    if (typeof label === "string" && typeof value === "number" && Number.isFinite(value)) {
      rows.push({ label, value });
    }
  }

  if (rows.length === 0) {
    return `Sobre ${title}, los detalles están en la gráfica del artículo.`;
  }

  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

  if (rows.length === 1) {
    return `Sobre ${title}: ${top.label}, ${fmt(top.value)}.`;
  }
  return (
    `Sobre ${title}: el valor más alto es ${top.label} con ${fmt(top.value)}, ` +
    `y el más bajo es ${bottom.label} con ${fmt(bottom.value)}, sobre ${rows.length} casos medidos. ` +
    `La gráfica completa está en el artículo.`
  );
}

interface Section {
  heading: string | null;
  text: string;
}

// Splits the body into sections at <h2>, replacing each <!--chart:key--> placeholder with the
// deterministic prose description. Chart placeholders are why this can't just strip tags: the
// chart IS the finding in an investigación, so dropping it would gut the piece.
function buildSections(bodyHtml: string, charts: Map<string, ChartRow>): Section[] {
  const withCharts = bodyHtml.replace(/<!--chart:([a-z0-9-]+)-->/g, (_all, key: string) => {
    const chart = charts.get(key);
    return chart ? `<p>${describeChart(chart)}</p>` : "";
  });

  const sections: Section[] = [];
  const parts = withCharts.split(/(?=<h2)/g);
  for (const part of parts) {
    const headingMatch = part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const heading = headingMatch ? stripTags(headingMatch[1]) : null;
    const body = headingMatch ? part.slice(headingMatch[0].length) : part;
    const text = stripTags(body);
    if (text) sections.push({ heading, text });
  }
  return sections;
}

// A separator is only part of the number when digits follow it. The naive `\d[\d.,]*`
// greedily swallows sentence-ending punctuation, so "en 2026." captured as "2026." never
// matched the source's "2026" and every year in the article read as an invented figure --
// which sent 12 of 13 sections back to unadapted text on the first real run.
const NUMBER_RE = /\d+(?:[.,]\d+)*/g;

// Normalizes so 1,200 and 1.200 and 1200 compare equal -- Spanish and English group digits
// differently and the model may reformat them legitimately while keeping the value.
function normalizeNumber(raw: string): string {
  return raw.replace(/[.,](?=\d{3}\b)/g, "").replace(/,(\d{1,2})$/, ".$1").replace(/\.0+$/, "");
}

// Returns numbers present in the adapted text that do NOT appear in the source. A non-empty
// result means the model invented a figure, which for a journalism-adjacent site is a
// correctness failure, not a style nit.
export function findInventedNumbers(source: string, adapted: string): string[] {
  const sourceNumbers = new Set((source.match(NUMBER_RE) ?? []).map(normalizeNumber));
  const invented: string[] = [];
  for (const raw of adapted.match(NUMBER_RE) ?? []) {
    const norm = normalizeNumber(raw);
    // Single digits are almost always ordinary prose ("dos razones"), not data claims.
    if (norm.replace(/[^\d]/g, "").length <= 1) continue;
    if (!sourceNumbers.has(norm)) invented.push(raw);
  }
  return [...new Set(invented)];
}

// Pause lengths, in seconds, tuned by ear (2026-08-22). Esteban's note was that the narration
// "se escucha súper plano, sin pausas" and specifically that the title ran straight into what
// follows -- a paragraph break on the page is silent to a listener unless something marks it.
// <break> is honored by eleven_multilingual_v2; this was verified in an A/B before relying on it.
const PAUSE_AFTER_TITLE = 1.2;
const PAUSE_AFTER_SUBTITLE = 1.5;
const PAUSE_AFTER_HEADING = 0.8;
const PAUSE_BETWEEN_PARAGRAPHS = 0.6;

function br(seconds: number): string {
  return `<break time="${seconds}s" />`;
}

// Turns blank-line paragraph breaks into audible breaths. Note these tags are part of the text
// sent to ElevenLabs and therefore billable -- roughly 22 characters each, so a long article
// with 50 paragraphs adds ~1k characters (~$0.11). Cheap for what it buys.
function withBreaths(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(` ${br(PAUSE_BETWEEN_PARAGRAPHS)} `);
}

function prompt(locale: string, title: string, heading: string | null, text: string): string {
  const language = locale.startsWith("en") ? "inglés" : "español";
  return `Vas a adaptar un fragmento de un artículo para que sea NARRADO en voz alta en ${language}.

Artículo: "${title}"
${heading ? `Sección: "${heading}"` : ""}

REGLAS ABSOLUTAS:
1. NO cambies, redondees, inventes ni omitas ninguna cifra, porcentaje, fecha o nombre propio. Cópialos exactamente.
2. NO agregues información que no esté en el texto.
3. Convierte listas con viñetas en prosa hablada fluida.
4. Elimina referencias visuales ("como se ve en la tabla", "la figura de abajo") y reemplázalas por la información en palabras.
5. Elimina URLs y citas entre paréntesis; si la fuente importa, menciónala en prosa natural.
6. Mantén el tono analítico y directo del original. No agregues saludos, despedidas ni frases de relleno.
7. Devuelve ÚNICAMENTE el texto adaptado, sin comentarios ni encabezados.

Texto a adaptar:
${text}`;
}

export interface ScriptResult {
  script: string;
  sections: number;
  warnings: string[];
}

// Builds the full narration script. Adapts section by section rather than in one shot: whole
// articles run past a comfortable context for this model, and per-section calls keep the
// number guard tight enough to attribute a failure to a specific passage.
export async function buildAudioScript(
  entityType: EntityType,
  entityId: number,
  locale = "es-MX"
): Promise<ScriptResult> {
  const table = entityType === "columna" ? "columns" : "investigaciones";
  const row = await env.DB.prepare(`SELECT title, subtitle, body_html FROM ${table} WHERE id = ?`)
    .bind(entityId)
    .first<{ title: string; subtitle: string | null; body_html: string }>();
  if (!row) throw new Error(`${entityType} ${entityId} not found`);

  const charts = new Map<string, ChartRow>();
  if (entityType === "investigacion") {
    const chartRows = await env.DB.prepare(
      `SELECT chart_key, chart_type, title, description, data_json, source_note
       FROM investigacion_charts WHERE investigacion_id = ? ORDER BY position ASC`
    )
      .bind(entityId)
      .all<ChartRow>();
    for (const chart of chartRows.results ?? []) charts.set(chart.chart_key, chart);
  }

  const sections = buildSections(row.body_html, charts);
  const warnings: string[] = [];
  const adapted: string[] = [];

  // Spoken intro: the title and standfirst orient a listener who has no page in front of them.
  // They get their own beats -- run together they read as one long run-on sentence, which is
  // exactly what sounded wrong in the first real narration.
  const title = row.title.trim().replace(/\.$/, "");
  const introParts = [`${title}.`, br(PAUSE_AFTER_TITLE)];
  if (row.subtitle?.trim()) {
    introParts.push(`${row.subtitle.trim().replace(/\.$/, "")}.`, br(PAUSE_AFTER_SUBTITLE));
  }
  adapted.push(introParts.join(" "));

  for (const section of sections) {
    const out = await llm(prompt(locale, row.title, section.heading, section.text));
    if (!out) {
      warnings.push(`sección "${section.heading ?? "(sin título)"}" quedó vacía tras la adaptación`);
      continue;
    }

    const invented = findInventedNumbers(section.text, out);
    if (invented.length > 0) {
      // Fall back to the stripped original rather than publishing a fabricated figure. The
      // original reads less smoothly; that is strictly better than reading a wrong number.
      warnings.push(
        `sección "${section.heading ?? "(sin título)"}": cifras inventadas ${invented.join(", ")} — se usó el texto original`
      );
      adapted.push(
        section.heading
          ? `${section.heading}. ${br(PAUSE_AFTER_HEADING)} ${withBreaths(section.text)}`
          : withBreaths(section.text)
      );
      continue;
    }

    adapted.push(
      section.heading ? `${section.heading}. ${br(PAUSE_AFTER_HEADING)} ${withBreaths(out)}` : withBreaths(out)
    );
  }

  return { script: adapted.join("\n\n"), sections: sections.length, warnings };
}

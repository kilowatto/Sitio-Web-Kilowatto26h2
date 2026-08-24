import { env } from "cloudflare:workers";
import { loadArticle, findInventedNumbers, responseText, type EntityType } from "./audio-script";

// Turns a published piece into the props a Remotion clip needs.
//
// The division of labour matters and is easy to get wrong: the MODEL writes the words, and the
// DATA comes straight out of investigacion_charts. Nothing numeric is ever invented, and the
// figures shown on screen are the same ones the article shows, byte for byte -- the same rule
// already written into column-infographic.ts, that an infographic's whole job is showing correct
// numbers. A generative video model cannot be trusted with a digit; a deterministic renderer
// reading a database can.
//
// Two durations, per Esteban: ~30 s for a column, ~75 s for an investigación. And the hook
// follows the duration -- cold open on the long ones, hard figure on the short ones -- because a
// 30-second clip has no room to set up a question and then answer it.

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export const CLIP_SECONDS = { columna: 30, investigacion: 75 } as const;

export interface ClipBar {
  label: string;
  value: number;
  displayValue: string;
}

export interface ClipProps {
  eyebrow: string;
  hook: string;
  chartTitle: string;
  items: ClipBar[];
  sourceNote?: string;
  cta: string;
  durationSeconds: number;
  /** Raw model output, only when debug is on. A global was tried first and did not survive. */
  _raw?: string;
  /** Narration for the clip, spoken by Larry. Synthesized separately. */
  narration: string;
  warnings: string[];
}

async function llm(prompt: string, maxTokens = 900): Promise<string> {
  const res: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens });
  return responseText(res?.response);
}

function parseObject(raw: string): any | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const a = body.indexOf("{");
  const b = body.lastIndexOf("}");
  if (a === -1 || b <= a) return null;
  try {
    return JSON.parse(body.slice(a, b + 1));
  } catch {
    return null;
  }
}

interface ChartRow {
  chart_key: string;
  chart_type: string;
  title: string | null;
  description: string | null;
  data_json: string | null;
  source_note: string | null;
}

// Only bar-shaped data survives the trip to a vertical clip. A radar or a heatmap needs a legend
// and a second look, which a phone screen scrolling past does not get.
function toBars(chart: ChartRow): ClipBar[] {
  try {
    const data = JSON.parse(chart.data_json ?? "{}");
    const items = data.items ?? data.segments ?? data.steps ?? [];
    const bars: ClipBar[] = [];
    for (const it of items) {
      const v = it.values?.[0] ?? it;
      const value = Number(v?.value);
      // Negative values are a different chart. A bar's length cannot be less than nothing, and a
      // series mixing -22% with +5.3% needs a baseline and a direction to read at all -- rendered
      // as plain bars it would show the biggest drop as the longest bar, which inverts the
      // meaning. Investigación 3 picked exactly such a chart on the first run.
      // The stored `value` is the bar LENGTH and is always positive; the sign lives in
      // displayValue. Investigación 3's German chart has value 22 with displayValue "-22%", so
      // checking the number alone let it through and would have drawn the biggest DROP as the
      // longest bar -- the exact inverse of what it means.
      const label = String(v?.displayValue ?? "");
      if (!Number.isFinite(value) || value < 0 || /^[-−]/.test(label.trim()) || /[+]/.test(label)) return [];
      // Labels are written for a page, not for a phone held at arm's length. The parenthetical
      // is nearly always the source ("(AV-TEST)"), which sourceNote already carries, and a hard
      // slice cut it mid-word into "AV-Comparativ". Drop the parenthetical, then cut on a word
      // boundary if it is still too long.
      const raw = String(it.label ?? "").replace(/\s*\([^)]*\)?\s*$/, "").trim();
      const label = raw.length <= 42 ? raw : raw.slice(0, raw.lastIndexOf(" ", 42) > 20 ? raw.lastIndexOf(" ", 42) : 42) + "…";
      bars.push({
        label,
        value,
        displayValue: String(v?.displayValue ?? value),
      });
    }
    // Three bars is what fits without shrinking the type below thumbnail legibility. Sorted by
    // value so the strongest figure is the one the eye lands on first.
    return bars.sort((a, b) => b.value - a.value).slice(0, 3);
  } catch {
    return [];
  }
}

export async function buildClipProps(
  entityType: EntityType,
  entityId: number,
  chartKey?: string,
  debug = false
): Promise<ClipProps> {
  const { title, subtitle, sections } = await loadArticle(entityType, entityId, "es-MX");
  const warnings: string[] = [];
  const durationSeconds = CLIP_SECONDS[entityType];
  const isLong = entityType === "investigacion";

  // Pick the chart. Bar-shaped only, and the one with the widest spread between its largest and
  // smallest value -- a chart where everything is 48%, 50%, 51% says nothing at a glance.
  let chart: ChartRow | null = null;
  let bars: ClipBar[] = [];
  if (entityType === "investigacion") {
    const rows = await env.DB.prepare(
      `SELECT chart_key, chart_type, title, description, data_json, source_note
         FROM investigacion_charts WHERE investigacion_id = ? ORDER BY position ASC`
    )
      .bind(entityId)
      .all<ChartRow>();
    const candidates = (rows.results ?? [])
      .filter((c) => ["bar", "donut", "funnel"].includes(c.chart_type))
      .map((c) => ({ chart: c, bars: toBars(c) }))
      .filter((c) => c.bars.length >= 2)
      // A chart reading 23, 23, 22 says nothing at a glance, and handing it to the model invites
      // it to invent a story the numbers do not tell -- which is exactly what happened on
      // investigación 3, where a table of worldwide enrolment SHARES became "la IA ya está
      // cancelando un tercio de los programas universitarios". Require real separation.
      .filter((c) => {
        const hi = c.bars[0].value;
        const lo = c.bars[c.bars.length - 1].value;
        return hi > 0 && (hi - lo) / hi >= 0.25;
      });
    const chosen = chartKey
      ? candidates.find((c) => c.chart.chart_key === chartKey)
      : candidates.sort(
          (a, b) =>
            b.bars[0].value - b.bars[b.bars.length - 1].value - (a.bars[0].value - a.bars[a.bars.length - 1].value)
        )[0];
    if (chosen) {
      chart = chosen.chart;
      bars = chosen.bars;
    }
  }

  if (bars.length === 0) {
    // Columns have no structured data at all -- their infographic bars are hardcoded per column
    // inside generate-images.ts -- so for now they get no chart. The clip still works; it is
    // just a hook and a pointer. Fixing that is D2 in the sprint.
    warnings.push("sin datos estructurados: el clip sale sin gráfica");
  }

  // Two texts, on purpose. The PROMPT gets a slice because the model has a context budget; the
  // NUMBER GUARD gets the whole article, because a figure living past character 6000 is still a
  // real figure. Checking against the slice made the guard reject "100 VPN gratuitas", "65+
  // fuentes" and "12,200 programas" -- every one of them straight out of the piece -- and it
  // killed all three clips before this was caught.
  // Subtitle and executive summary count as source too. "65+ fuentes primarias" lives in
  // investigación 2's summary and nowhere in its body, so the guard called a figure straight off
  // the article's own standfirst invented.
  const extra = await env.DB.prepare(
    `SELECT COALESCE(summary, '') AS summary FROM ${entityType === "columna" ? "columns" : "investigaciones"} WHERE id = ?`
  )
    .bind(entityId)
    .first<{ summary: string }>()
    .catch(() => ({ summary: "" }));
  const fullText = [sections.map((x) => x.text).join("\n\n"), subtitle ?? "", extra?.summary ?? ""].join("\n\n");
  const sourceText = fullText.slice(0, 6000);
  const figures = bars.map((b) => `${b.label}: ${b.displayValue}`).join("; ");

  // The chart's own title and description travel with the figures. Without them the model sees
  // "STEM: 23" and has no way to know whether that is a count, a percentage of something, or a
  // change over time -- and it will guess, confidently, in enormous type.
  const chartContext = chart
    ? `Esa gráfica se titula "${chart.title ?? ""}"${chart.description ? ` y dice: ${chart.description}` : ""}.`
    : "";

  const minNarration = Math.round(durationSeconds * 2.1);
  const maxNarration = Math.round(durationSeconds * 2.6);

  const prompt = `Escribe el texto de un clip vertical de ${durationSeconds} segundos sobre esta pieza de Kilowatto.

Título: "${title}"
${subtitle ? `Bajada: ${subtitle}` : ""}
${figures ? `Cifras que se van a MOSTRAR en pantalla, en barras, mientras se escucha la narración: ${figures}` : ""}
${chartContext ? `QUÉ SIGNIFICAN ESAS CIFRAS: ${chartContext} No inventes otra interpretación.` : ""}
${figures ? "EL GANCHO TIENE QUE SER SOBRE ESAS CIFRAS. Es lo que se ve en pantalla; un gancho sobre otro tema de la pieza deja al espectador leyendo una cosa y escuchando otra." : ""}

${isLong
  ? "GANCHO: empieza por lo que quien mira cree que ya sabe y resulta falso. Una afirmación que contradiga el sentido común, sin resolverla."
  : "GANCHO: empieza por la afirmación más fuerte y concreta de la pieza, de golpe. No preguntes: en 30 segundos no hay espacio para plantear y responder."}

Reglas duras:
- El gancho es una FRASE COMPLETA con verbo, de 6 a 12 palabras. Va en tipografía enorme.
  "VPN no protege" no sirve: no es una frase, es un telegrama.
- La narración es lo que se ESCUCHA mientras las barras aparecen. Entre ${minNarration} y ${maxNarration}
  caracteres. PROHIBIDO leer las cifras una por una: ya están en pantalla y repetirlas suena a
  teleprompter. Di qué SIGNIFICAN y qué se hace con eso.
- Usa SOLO cifras que aparezcan en el texto fuente o en la lista de arriba, con dígitos.
- Nada de "no te lo pierdas", "increíble", "la verdad" ni superlativos.

Así se ve bien, para una pieza sobre VPN:
{"hook":"Nueve de cada diez VPN gratuitas filtran tus datos.",
 "narration":"La promesa de una VPN gratuita es que nadie te vea. Una auditoría de cien de ellas encontró lo contrario: la mayoría filtra algo, muchas piden permisos que su función no necesita, y la mitad comparte lo que recoge con terceros que tú nunca elegiste. Lo gratis lo pagas con lo que querías esconder.",
 "cta":"La investigación completa"}

Responde SOLO un objeto JSON con esa forma exacta.

Texto fuente:
${sourceText}`;

  // Two attempts. The model returns valid JSON and lazy content: the first run gave a
  // fourteen-character hook with no verb and a narration less than half the length asked for,
  // which listed the on-screen figures it had just been told not to list. Naming the shortfall
  // is what fixes it -- the same thing that fixed the dialogue generator.
  let raw = await llm(prompt, 1200);
  let parsed = parseObject(raw);
  const tooShort = (p: any) =>
    !p?.hook ||
    !p?.narration ||
    String(p.hook).trim().split(/\s+/).length < 5 ||
    String(p.narration).length < minNarration * 0.75;

  if (tooShort(parsed)) {
    warnings.push("primer intento demasiado corto; se reintentó");
    raw = await llm(
      `${prompt}\n\nTu intento anterior fue: ${JSON.stringify(parsed ?? {})}\nEs demasiado corto. El gancho necesita al menos 6 palabras y ser una frase completa; la narración necesita al menos ${minNarration} caracteres. Reescríbelo entero.`,
      1400
    );
    const retry = parseObject(raw);
    if (!tooShort(retry)) parsed = retry;
  }
  let hook = String(parsed?.hook ?? "").trim();
  let narration = String(parsed?.narration ?? "").trim();
  const cta = String(parsed?.cta ?? "").trim() || (isLong ? "La investigación completa" : "La columna completa");

  if (!hook || !narration) {
    warnings.push("el modelo no devolvió gancho o narración; se usó el título");
    hook = hook || title.split(":")[0].slice(0, 70);
    narration = narration || `${title}. ${subtitle ?? ""}`.trim();
  }

  // The number guard, same as narration and dialogue. A clip is the most quotable format we
  // publish -- a wrong figure in enormous type on someone else's feed is not something a
  // correction reaches.
  const invented = findInventedNumbers(`${fullText} ${figures}`, `${hook} ${narration}`);
  if (invented.length > 0) {
    warnings.push(`cifras inventadas ${invented.join(", ")} — se cayó al título`);
    hook = title.split(":")[0].slice(0, 70);
    narration = `${title}. ${subtitle ?? ""}`.trim();
  }

  return {
    ...(debug ? { _raw: raw.slice(0, 1500) } : {}),
    eyebrow: isLong ? "A fondo" : "Columna",
    hook,
    chartTitle: chart?.title?.replace(/^Gráfica \d+ · /, "") ?? "",
    items: bars,
    sourceNote: chart?.source_note ?? undefined,
    cta,
    durationSeconds,
    narration,
    warnings,
  };
}

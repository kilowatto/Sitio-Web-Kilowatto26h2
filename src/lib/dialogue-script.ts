import { env } from "cloudflare:workers";
import { loadArticle, findInventedNumbers, responseText, type EntityType, type Section } from "./audio-script";
import type { DialogueTurn } from "./elevenlabs-dialogue";

// Turns an investigación into a conversation between Larry and Leia.
//
// This exists because the faithful narration of an investigación runs 27, 30 and 64 minutes,
// and Esteban could not sit through his own. Columns at ~6 minutes keep the narration and are
// not touched by any of this.
//
// The important thing this is NOT: a reading of the article with the lines split between two
// voices. Two people discussing a piece take LONGER per unit of content than one person
// reading it, so a conversation that covers everything would be worse, not better. The job
// here is selection -- six or seven findings out of a piece with twenty sections -- and the
// outline pass below is where that happens.

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Measured, not estimated: the Larry+Leia bench sample was 1,293 characters and came back as
// 88.2 seconds of audio => 879 chars/min. Dialogue is slower than narration because every
// speaker change costs a beat of silence, so do not reuse the narration figure here.
const CHARS_PER_MINUTE = 879;
const TARGET_MINUTES = 20;
const TARGET_CHARS = CHARS_PER_MINUTE * TARGET_MINUTES;

// Six to eight findings at twenty minutes is about two and a half minutes each once the open
// and close are paid for. Fewer and it is a summary; more and each one gets too little room to
// land.
// How much more than the requested budget the model actually writes. Do not read this as a
// precise dial: across runs on the same piece the finished script landed anywhere from 8,800 to
// 24,000 characters, so the run-to-run variance is larger than any calibration error. It is set
// so the CENTRAL case lands near the target; MAX_CHARS below catches the long tail, and a short
// episode is left alone -- 12 minutes of real conversation beats padding it out to hit a number.
const BUDGET_OVERSHOOT = 1.15;

// A hard ceiling on top of the calibration, because the overshoot is not perfectly stable.
// Past this the trailing findings are dropped rather than shipping a 30-minute episode -- which
// is the exact problem this format exists to fix.
const MAX_CHARS = Math.round(CHARS_PER_MINUTE * (TARGET_MINUTES + 4));

const MIN_BEATS = 5;
const MAX_BEATS = 9;

// The host is the brand itself, not the rhino. Larry keeps narrating the columns and the full
// readings -- Esteban's call, and the narration on multilingual_v2 is the one he signed off on.
// This character exists only in the podcast, and he is presenting his OWN research, which is why
// nothing here attributes the work to a third party any more.
export const HOST_NAME = "Kilowatto";
export const COHOST_NAME = "Leia";

async function llm(prompt: string, maxTokens = 2048): Promise<string> {
  const result: any = await env.AI.run(MODEL, {
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
  });
  return responseText(result?.response);
}

// Models wrap JSON in prose and fences no matter how firmly you ask them not to.
function parseJsonArray(raw: string): any[] | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(body.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseJsonObject(raw: string): any | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Number words are the hole in findInventedNumbers(): it compares digit strings, so a turn
// that says "ciento siete dólares" contains no digits at all and passes the guard trivially.
// The scripts are therefore written with digits, and this flags the case where the model
// ignored that instruction -- as a warning, since a stray "dos razones" is not a data claim.
const SPELLED_NUMBER_RE =
  /\b(cien|ciento|mil|millones|millón|billones|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|hundred|thousand|million|billion|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/gi;

// The model labels turns with the CHARACTER NAMES it was given, not with the role keys the
// schema asks for -- it answered "Larry"/"Leia" on the first real run. Mapping anything
// unrecognised to "host" turned all 22 turns into one speaker, and mergeAdjacent then glued the
// whole segment into a single four-minute Larry monologue that still passed every other check.
function normalizeSpeaker(raw: unknown): SpeakerId | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "host" || v === HOST_NAME.toLowerCase()) return "host";
  if (v === "cohost" || v === "co-host" || v === "guest" || v === COHOST_NAME.toLowerCase()) return "cohost";
  return null;
}

// eleven_v3 performs bracketed audio tags instead of speaking them -- but only the ones it
// knows. An invented tag like [música de fondo] is read out loud as words, so anything outside
// this list is stripped rather than trusted. Kept small on purpose: a conversation sprinkled
// with [laughs] every other turn stops sounding like people and starts sounding like a sitcom.
const ALLOWED_TAGS = new Set([
  "laughs", "sighs", "exhales", "curious", "excited", "surprised", "sarcastic", "hesitates",
]);
const TAG_RE = /\[([a-zA-Z ]{2,20})\]/g;

function stripUnknownTags(text: string): { text: string; removed: string[] } {
  const removed: string[] = [];
  const cleaned = text.replace(TAG_RE, (all, inner: string) => {
    if (ALLOWED_TAGS.has(inner.trim().toLowerCase())) return all;
    removed.push(inner.trim());
    return "";
  });
  return { text: cleaned.replace(/\s{2,}/g, " ").trim(), removed };
}

/** Audio tags are performance directions, not words: a reader should never see them. */
export function stripAllTags(text: string): string {
  return text.replace(TAG_RE, "").replace(/\s{2,}/g, " ").trim();
}

interface Beat {
  /** Which of the article's sections this beat is built from. */
  sectionIndex: number;
  /** One line naming the finding, used to steer the turn writer. */
  finding: string;
}

function outlinePrompt(locale: string, title: string, sections: Section[]): string {
  const inventory = sections
    .map((s, i) => `[${i}] ${s.heading ?? "(sin encabezado)"} — ${s.text.slice(0, 320).replace(/\s+/g, " ")}…`)
    .join("\n\n");

  if (locale.startsWith("en")) {
    return `You are the producer of a podcast episode about the investigation "${title}".

Below is every section of the piece. Pick the ${MIN_BEATS} to ${MAX_BEATS} findings that a listener
would most want to hear, in the order that tells the best story. Ignore sections that are setup,
methodology or housekeeping.

Reply with ONLY a JSON array, one object per finding:
[{"sectionIndex": 0, "finding": "one line naming the finding"}]

Sections:
${inventory}`;
  }

  return `Eres el productor de un episodio de podcast sobre la investigación "${title}".

Abajo están todas las secciones de la pieza. Elige los ${MIN_BEATS} a ${MAX_BEATS} hallazgos que
más le interesarían a quien escucha, en el orden que cuenta mejor la historia. Ignora las
secciones que son planteamiento, metodología o trámite.

Responde SOLO con un arreglo JSON, un objeto por hallazgo:
[{"sectionIndex": 0, "finding": "una línea que nombre el hallazgo"}]

Secciones:
${inventory}`;
}

// The cold open, and it is not decoration.
//
// Two findings from the research literature decide its shape:
//
// Loewenstein (1994) -- curiosity is the feeling of a gap in what you know, and it only appears
// if you already know enough to NOTICE the gap. Complete ignorance produces nothing. So the
// opening has to be about something the listener already holds an opinion on, not about
// something new.
//
// Muller's 2008 thesis (the Veritasium PhD) -- a clear exposition leaves people no more correct
// but MORE CONFIDENT, which is worse than no instruction at all. What works is surfacing the
// wrong belief first and then breaking it. His own summary: clarity numbs the mind, confusion
// cracks it open.
//
// So: state the belief the listener is confident about, break it with one fact, and do NOT
// resolve it. The unresolved gap is the whole mechanism. Leia says the confident wrong thing --
// dramatised the way Muller's street-corner quiz does it, rather than Larry lecturing about a
// misconception nobody admitted to holding.
function hookPrompt(locale: string, title: string, fullText: string): string {
  if (locale.startsWith("en")) {
    return `Read the investigation below and design the cold open for a podcast episode about it.

Find the single place where the piece contradicts what a normal, reasonably informed person
would confidently assume. Not the most important finding -- the most SURPRISING one.

Reply with ONLY a JSON object, every value a COMPLETE sentence:
{"question":"a short question the listener thinks they already know the answer to",
 "commonAnswer":"what almost everyone answers, in the words they would use",
 "breaker":"the fact from the piece that shows the common answer is wrong, with its figure",
 "topic":"one to three words naming the subject, for the announcer"}

Worked example, for a piece about VPNs:
{"question":"A VPN hides your browsing from your internet provider. That is what it is for, right?",
 "commonAnswer":"Right, that is the whole point of paying for one.",
 "breaker":"Half of the 100 most downloaded free VPNs were sending user data to third parties, including ByteDance and Yandex.",
 "topic":"VPNs"}

Rules:
- "breaker" must come from the piece. Invent nothing, and write figures in digits.
- Do NOT explain or resolve it. The opening exists to leave a gap, not to close it.
- The question has to be about something the listener already has an opinion on. A question
  about something nobody has ever thought about produces no curiosity at all.

Investigation:
${fullText}`;
  }

  return `Lee la investigación de abajo y diseña la apertura en frío de un episodio de podcast.

Encuentra el punto donde la pieza contradice lo que una persona normal y razonablemente informada
daría por hecho con confianza. No el hallazgo más importante: el más SORPRENDENTE.

Responde SOLO con un objeto JSON, y cada valor tiene que ser una frase COMPLETA:
{"question":"una pregunta corta cuya respuesta quien escucha cree que ya sabe",
 "commonAnswer":"lo que contesta casi todo el mundo, con las palabras que usaría",
 "breaker":"el dato de la pieza que demuestra que esa respuesta está mal, con su cifra",
 "topic":"una a tres palabras que nombren el tema, para el locutor"}

Ejemplo resuelto, para una pieza sobre VPN:
{"question":"Una VPN esconde lo que navegas de tu proveedor de internet. Para eso es, ¿no?",
 "commonAnswer":"Pues sí, para eso paga uno.",
 "breaker":"La mitad de las 100 apps de VPN gratuitas más descargadas mandaban datos de sus usuarios a terceros, entre ellos ByteDance y Yandex.",
 "topic":"VPN"}

Reglas:
- "breaker" tiene que salir de la pieza. No inventes nada, y escribe las cifras con dígitos.
- NO lo expliques ni lo resuelvas. La apertura existe para dejar un hueco, no para cerrarlo.
- La pregunta tiene que ser sobre algo de lo que quien escucha ya tiene una opinión. Una pregunta
  sobre algo que nadie se ha planteado nunca no produce curiosidad ninguna.

Investigación:
${fullText}`;
}

function turnsPrompt(
  locale: string,
  title: string,
  finding: string,
  sourceText: string,
  budgetChars: number
): string {
  const shared = { host: HOST_NAME, cohost: COHOST_NAME };

  if (locale.startsWith("en")) {
    return `Write one segment of a podcast conversation about the investigation "${title}".

The two speakers:
- ${shared.host} did the investigation and is telling it. Dry, concrete, seasoned. He talks about
  his own work: "I found", "it took me weeks to", "what I did not expect was".
- ${shared.cohost} is an ostrich. She is the sociable, curious one: she asks, reacts, and pushes
  back when something sounds off. She is not an expert and never pretends to be.

This segment covers exactly one finding: ${finding}

Rules, all of them hard:
- Base every claim ONLY on the source text below. Invent nothing.
- Write every figure in DIGITS, exactly as the source writes it. Never spell a number out.
- Neither speaker may bring in knowledge from outside the piece. ${shared.host} reports what THIS
  investigation found and nothing else: no other sources, no other cases, no prior experience to
  cite. Never mention a person's name.
- No greetings, no sign-off, no "welcome back". This is the middle of an episode.

Pacing:
- Every ${shared.host} turn carries the whole piece of evidence: the figure, where it comes from,
  and what it means. Between 250 and 450 characters. A single stray sentence is not a turn.
- Every ${shared.cohost} turn is ONE concrete question about what ${shared.host} just said.
  Between 60 and 140 characters. A question, not a paragraph.
- Write exactly ${Math.max(8, Math.round(budgetChars / 220))} turns, alternating, and roughly
  ${budgetChars} characters in total. If you fall short, go deeper into the SAME finding using more
  of the source text; do not invent new material and do not move on to another topic.

Make it sound like people talking, not two announcers reading:
- Use fillers where they land naturally: "well", "look", "hang on", "right?", "I mean", "okay so".
  One or two per turn at most; overdoing it is more tiring than leaving them out.
- ${shared.cohost} can cut in to ask for a figure again, or react before she asks. ${shared.host}
  can correct himself mid-sentence or open with "well, it depends".
- You may mark the performance with bracketed tags, sparingly -- at most one every three or four
  turns. The only allowed ones are: [laughs], [sighs], [exhales], [curious], [excited],
  [surprised], [sarcastic], [hesitates]. Anything else is stripped, so do not invent any.

What neither of them ever does, because the piece does not say it:
- Give the listener advice or recommendations ("the important thing is to do your research",
  "check the terms"). They report what the investigation found; they do not advise.
- Ask for advice: ${shared.cohost} asks about the FACTS of the finding, never "what would you
  recommend to people?".
- Opine in the abstract about how important the topic is, or talk about the episode itself.
- Say that the investigation "does not mention" something. If a fact is not in the source text,
  ${shared.cohost} simply does not ask about it: talking about what the document lacks breaks the
  conversation and helps nobody.

This is the right rhythm:
[{"speaker":"host","text":"The charge was 107 dollars. The same VPN he had signed up for two years earlier at 2.19 a month. It was not a billing error: it is the auto-renewal price, which the company never put in large type."},
 {"speaker":"cohost","text":"So it went from 2 dollars to 107. Is that even allowed?"},
 {"speaker":"host","text":"It is, and it did not only happen to him. An analysis of nearly 30,000 Android reviews of the four largest providers found that complaints about auto-renewals and price jumps dominate the negative reviews. NordVPN is also facing four lawsuits in United States federal courts."}]

Reply with ONLY a JSON array in exactly that shape, using "host" and "cohost" as the speaker.

Source text:
${sourceText}`;
  }

  return `Escribe un segmento de una conversación de podcast sobre la investigación "${title}".

Los dos que hablan:
- ${shared.host} es quien hizo la investigación y la está contando. Seco, concreto, con oficio.
  Habla de su propio trabajo: "encontré", "me tardé semanas en", "lo que no esperaba era".
- ${shared.cohost} es una avestruz. Es la sociable y curiosa: pregunta, reacciona y contradice
  cuando algo suena raro. No es experta y nunca finge serlo.

Este segmento cubre exactamente un hallazgo: ${finding}

Reglas, todas duras:
- Basa cada afirmación SOLO en el texto fuente de abajo. No inventes nada.
- Escribe cada cifra con DÍGITOS, tal como la escribe la fuente. Nunca deletrees un número.
- Ninguno de los dos puede aportar conocimiento de fuera de la pieza. ${shared.host} cuenta lo
  que ESTA investigación encontró y nada más: no tiene otras fuentes, otros casos ni experiencia
  previa que citar. Nunca menciones el nombre de una persona.
- Sin saludos, sin despedida, sin "regresamos". Esto es la mitad de un episodio.

El ritmo:
- Cada turno de ${shared.host} trae la evidencia completa: el dato, de dónde sale y qué implica.
  Entre 250 y 450 caracteres. Una frase suelta no es un turno.
- Cada turno de ${shared.cohost} es UNA pregunta concreta sobre lo que ${shared.host} acaba de
  decir. Entre 60 y 140 caracteres. Una pregunta, no un párrafo.
- Escribe exactamente ${Math.max(8, Math.round(budgetChars / 220))} turnos, alternando, y unos
  ${budgetChars} caracteres en total. Si te quedas corto, profundiza en el MISMO hallazgo con más
  detalle del texto fuente; no inventes material nuevo ni te pases a otro tema.

Que suene a gente hablando, no a dos locutores leyendo:
- Usa muletillas donde caigan naturales: "o sea", "a ver", "mira", "pues", "bueno", "¿no?",
  "espérame", "híjole". Una o dos por turno como mucho; abusar cansa más que no usarlas.
- ${shared.cohost} puede interrumpir para pedir que le repitan un dato, o reaccionar antes de
  preguntar. ${shared.host} puede corregirse a media frase o arrancar con "bueno, depende".
- Puedes marcar la interpretación con etiquetas entre corchetes, en inglés y con moderación —
  como mucho una cada tres o cuatro turnos. Las únicas permitidas son: [laughs], [sighs],
  [exhales], [curious], [excited], [surprised], [sarcastic], [hesitates]. Cualquier otra se
  borra, así que no inventes.

Lo que ninguno de los dos hace nunca, porque la pieza no lo dice:
- Dar consejos ni recomendaciones al oyente ("lo importante es investigar", "revisa los términos").
  Reportan lo que encontró la investigación; no asesoran.
- Pedir consejos: ${shared.cohost} pregunta por los HECHOS del hallazgo, nunca "¿qué le
  recomendarías a la gente?".
- Opinar en abstracto sobre lo importante que es el tema, o hablar del episodio mismo.
- Decir que la investigación "no menciona" algo. Si un dato no está en el texto fuente,
  ${shared.cohost} simplemente no lo pregunta: hablar de lo que le falta al documento rompe la
  conversación y no le sirve a nadie.

Así se ve el ritmo correcto:
[{"speaker":"host","text":"El cargo que le llegó fue de 107 dólares. La misma VPN que había contratado dos años antes por 2.19 al mes. No es un error de facturación: es el precio de renovación automática, que la empresa nunca puso en letras grandes."},
 {"speaker":"cohost","text":"O sea que de 2 dólares saltó a 107. ¿Y eso se puede?"},
 {"speaker":"host","text":"Se puede, y no le pasó solo a él. Un análisis de casi 30,000 reseñas de Android de los cuatro proveedores más grandes encontró que las quejas por renovaciones automáticas y saltos de precio dominan las reseñas negativas. NordVPN además enfrenta cuatro demandas en cortes federales de Estados Unidos."}]

Responde SOLO con un arreglo JSON con esa forma exacta, usando "host" y "cohost" como speaker.

Texto fuente:
${sourceText}`;
}

// The close is a template, not model output: nothing here can invent a figure because there are
// no figures, and the pointer back to the full piece on the site is guaranteed to be in every
// episode instead of depending on the model remembering.
//
// The greeting comes AFTER the ident, which comes after the cold open. That order is the point,
// not a detail: a hook placed behind the branding is not a cold open, and the whole reason the
// form is called that is that the intrigue arrives before anyone tells you what show you are
// listening to.
function greetingTurns(locale: string, title: string, subtitle: string | null): DialogueTurn[] {
  if (locale.startsWith("en")) {
    return [
      {
        speaker: "host",
        text: `[excited] Hey! Let's go straight to the bottom of it, because today I have a Deep Dive: ${title}.${subtitle ? ` ${subtitle}` : ""}`,
      },
      { speaker: "cohost", text: `Alright ${HOST_NAME}, where do we start?` },
    ];
  }
  return [
    {
      speaker: "host",
      text: `[excited] ¡Qué tal! Vamos directos al fondo, que hoy traigo una investigación de A fondo: ${title}.${subtitle ? ` ${subtitle}` : ""}`,
    },
    { speaker: "cohost", text: `A ver ${HOST_NAME}, ¿por dónde empezamos?` },
  ];
}

// Turns the belief/breaker pair into the two-move open: Leia says the confident wrong thing,
// Larry breaks it and stops. Written as a template rather than asked of the model, because the
// one thing that must not happen is the open RESOLVING the gap it just made -- and "explain,
// but stop before the explanation" is exactly the instruction a model ignores.
function coldOpenTurns(
  locale: string,
  question: string,
  commonAnswer: string,
  breaker: string
): DialogueTurn[] {
  if (locale.startsWith("en")) {
    return [
      { speaker: "host", text: `${COHOST_NAME}, quick one. ${question}` },
      { speaker: "cohost", text: `[curious] ${commonAnswer}` },
      { speaker: "host", text: `That is what almost everybody answers. ${breaker}` },
      { speaker: "cohost", text: `[surprised] Hang on. What?` },
    ];
  }
  return [
    { speaker: "host", text: `${COHOST_NAME}, rápido. ${question}` },
    { speaker: "cohost", text: `[curious] ${commonAnswer}` },
    { speaker: "host", text: `Eso es lo que contesta casi todo el mundo. ${breaker}` },
    { speaker: "cohost", text: `[surprised] Espérame. ¿Cómo?` },
  ];
}

function closingTurns(locale: string, section: string, slug: string): DialogueTurn[] {
  if (locale.startsWith("en")) {
    return [
      { speaker: "host", text: `That is the short version. The piece has the sources, the charts and the parts we skipped.` },
      {
        speaker: "cohost",
        text: `The full investigation is on kilowatto.com, under ${section}. Look for "${slug}".`,
      },
    ];
  }
  return [
    { speaker: "host", text: `Esa es la versión corta. La pieza trae las fuentes, las gráficas y lo que nos saltamos.` },
    {
      speaker: "cohost",
      text: `La investigación completa está en kilowatto punto com, en la sección ${section}. Búscala como "${slug}".`,
    },
  ];
}

// Two consecutive turns by the same speaker become one. Left split they read as a stumble --
// the API inserts a turn boundary, so the same voice pauses mid-thought for no reason.
//
// Only WITHIN a group, never across one. Merging across beats produced "...según Latka Hoy, 6
// proveedores han pasado por auditorías..." -- the close of one finding welded to the open of
// the next, in a single breath, saying something neither half said. The opening and closing
// templates are their own groups for the same reason.
function mergeWithin(groups: DialogueTurn[][]): DialogueTurn[] {
  const out: DialogueTurn[] = [];
  for (const group of groups) {
    for (let i = 0; i < group.length; i++) {
      const last = out[out.length - 1];
      const sameGroupAsLast = i > 0;
      if (last && sameGroupAsLast && last.speaker === group[i].speaker) {
        last.text = `${last.text} ${group[i].text}`.trim();
      } else {
        out.push({ ...group[i] });
      }
    }
  }
  return out;
}

export interface DialogueScriptResult {
  /** Before the ident. Synthesized as its own segment so the sting can sit between them. */
  coldOpen: DialogueTurn[];
  /** After the ident: greeting, findings, close. */
  turns: DialogueTurn[];
  /** One to three words, for the announcer line. */
  topic: string;
  beats: number;
  characters: number;
  estimatedMinutes: number;
  warnings: string[];
}

/** Raw model output for one beat, so a parse failure can be diagnosed instead of guessed at. */
export async function debugFirstBeat(entityId: number, locale = "es-MX"): Promise<any> {
  const { title, sections } = await loadArticle("investigacion", entityId, locale);
  const outlineRaw = await llm(outlinePrompt(locale, title, sections), 1024);
  const parsedOutline = parseJsonArray(outlineRaw);
  const beat = (parsedOutline ?? [])[0];
  const idx = Number(beat?.sectionIndex ?? 0);
  const source = sections[idx]?.text ?? sections[0].text;
  const p = turnsPrompt(locale, title, String(beat?.finding ?? "primer hallazgo"), source, 2000);
  const raw = await llm(p, 1600);
  return {
    sections: sections.length,
    outlineRaw: outlineRaw.slice(0, 1200),
    outlineParsed: parsedOutline,
    promptChars: p.length,
    sourceChars: source.length,
    turnsRaw: raw.slice(0, 2000),
    turnsParsed: parseJsonArray(raw),
  };
}

export async function buildDialogueScript(
  entityType: EntityType,
  entityId: number,
  locale = "es-MX"
): Promise<DialogueScriptResult> {
  if (entityType !== "investigacion") {
    // Not a technical limit -- a decision. Esteban listened to both and the columns are fine
    // as narration; turning a six-minute piece into a conversation would make it longer for
    // no gain.
    throw new Error("el formato conversado es solo para investigaciones");
  }

  const { title, subtitle, sections } = await loadArticle(entityType, entityId, locale);
  const slugRow = await env.DB.prepare(`SELECT slug FROM investigaciones WHERE id = ?`)
    .bind(entityId)
    .first<{ slug: string }>();
  const slug = slugRow?.slug ?? "";
  const sectionName = locale.startsWith("en") ? "Deep Dives" : "A fondo";

  const warnings: string[] = [];

  // Outline pass: which findings make the episode.
  const outlineRaw = await llm(outlinePrompt(locale, title, sections), 1024);
  let beats: Beat[] = (parseJsonArray(outlineRaw) ?? [])
    .map((b: any) => ({ sectionIndex: Number(b?.sectionIndex), finding: String(b?.finding ?? "").trim() }))
    .filter((b) => Number.isInteger(b.sectionIndex) && sections[b.sectionIndex] && b.finding);

  if (beats.length === 0) {
    // Falling back to "the first N sections" is worse than the model's pick but far better
    // than failing: the sections are already in the author's order.
    warnings.push("el esquema no se pudo interpretar; se usaron las primeras secciones en orden");
    beats = sections.slice(0, MAX_BEATS).map((s, i) => ({
      sectionIndex: i,
      finding: s.heading ?? `sección ${i + 1}`,
    }));
  }
  beats = beats.slice(0, MAX_BEATS);

  // The hook reads the WHOLE piece, not one section: the most surprising thing is rarely in the
  // section the outline happened to rank first.
  const fullText = sections.map((x) => x.text).join("\n\n");
  const hook = parseJsonObject(await llm(hookPrompt(locale, title, fullText), 700));
  let coldOpen: DialogueTurn[] = [];
  let topic = title.split(/[:,—]/)[0].trim().split(/\s+/).slice(0, 3).join(" ");

  // A hook made of sentence fragments reads as a glitch, not as intrigue: the first attempt
  // returned "las VPN son gratuitas o baratas" and a bare "$70 a $80 mil millones", which
  // slotted into the template as ungrammatical noise. Complete sentences or no cold open.
  const complete = (v: unknown) =>
    typeof v === "string" && v.trim().length > 20 && /[.!?…]$|\?$/.test(v.trim());

  if (complete(hook?.question) && complete(hook?.commonAnswer) && complete(hook?.breaker)) {
    const inventedHook = findInventedNumbers(fullText, `${hook.question} ${hook.breaker}`);
    if (inventedHook.length > 0) {
      // No second attempt here. Without a cold open the episode still works; with a fabricated
      // figure in its first fifteen seconds it does not.
      warnings.push(`apertura descartada: cifras inventadas ${inventedHook.join(", ")}`);
    } else {
      coldOpen = coldOpenTurns(
        locale,
        String(hook.question).trim(),
        String(hook.commonAnswer).trim(),
        String(hook.breaker).trim()
      );
    }
    if (typeof hook.topic === "string" && hook.topic.trim()) topic = hook.topic.trim().slice(0, 40);
  } else {
    if (typeof hook?.topic === "string" && hook.topic.trim()) topic = hook.topic.trim().slice(0, 40);
    warnings.push("no se pudo construir la apertura en frío; el episodio arranca con el saludo");
  }

  const opening = greetingTurns(locale, title, subtitle);
  const closing = closingTurns(locale, sectionName, slug);
  const overhead = [...coldOpen, ...opening, ...closing].reduce((n, t) => n + t.text.length, 0);
  const budgetPerBeat = Math.max(
    600,
    Math.round((TARGET_CHARS - overhead) / beats.length / BUDGET_OVERSHOOT)
  );

  const body: DialogueTurn[][] = [];
  // Kept separate from `warnings` so a total failure can still say WHY, instead of just
  // reporting that nothing survived.
  const rejections: string[] = [];

  for (const beat of beats) {
    const source = sections[beat.sectionIndex].text;
    let accepted: DialogueTurn[] | null = null;

    // Two attempts. The second names the offending figures, which is usually enough -- the
    // model is normally paraphrasing a number rather than hallucinating one.
    for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
      let p = turnsPrompt(locale, title, beat.finding, source, budgetPerBeat);
      if (attempt > 0) {
        p += locale.startsWith("en")
          ? `\n\nYour previous attempt used figures that are NOT in the source text. Use only figures that appear above, verbatim.`
          : `\n\nTu intento anterior usó cifras que NO están en el texto fuente. Usa solo cifras que aparezcan arriba, tal cual.`;
      }

      const parsed = parseJsonArray(await llm(p, 1600));
      if (!parsed) continue;

      const candidate: DialogueTurn[] = [];
      const droppedTags: string[] = [];
      let unknownSpeakers = 0;
      for (let k = 0; k < parsed.length; k++) {
        const text = String(parsed[k]?.text ?? "").trim();
        if (!text) continue;
        const speaker = normalizeSpeaker(parsed[k]?.speaker);
        if (!speaker) unknownSpeakers++;
        // An unrecognised label alternates from whatever came before rather than defaulting to
        // one side, so a relabelling by the model degrades into a plausible conversation
        // instead of a monologue.
        const previous = candidate[candidate.length - 1]?.speaker;
        const cleaned = stripUnknownTags(text);
        if (cleaned.removed.length > 0) droppedTags.push(...cleaned.removed);
        if (!cleaned.text) continue;
        candidate.push({ speaker: speaker ?? (previous === "host" ? "cohost" : "host"), text: cleaned.text });
      }
      if (candidate.length === 0) continue;
      if (droppedTags.length > 0) {
        warnings.push(
          `hallazgo "${beat.finding}": etiquetas de audio desconocidas descartadas (${[...new Set(droppedTags)].join(", ")})`
        );
      }
      if (unknownSpeakers > 0) {
        warnings.push(
          `hallazgo "${beat.finding}": ${unknownSpeakers} turnos sin interlocutor reconocible — se alternaron`
        );
      }

      const invented = findInventedNumbers(source, candidate.map((t) => t.text).join(" "));
      if (invented.length > 0) {
        rejections.push(`"${beat.finding}" intento ${attempt + 1}: ${invented.join(", ")}`);
        if (attempt === 1) {
          // Unlike narration there is no original prose to fall back to -- a conversation has
          // no unadapted form -- so the beat is dropped and the episode loses one finding.
          // Publishing a fabricated figure is not on the table.
          warnings.push(
            `hallazgo "${beat.finding}": cifras inventadas ${invented.join(", ")} en dos intentos — se omitió`
          );
        }
        continue;
      }

      // "$357 millones" is a digit-bearing figure the guard already checked; only a bare word
      // like "ciento siete" is invisible to it. Without this the warning fires on every
      // segment that mentions a million and stops meaning anything.
      const joined = candidate.map((t) => t.text).join(" ");
      const spelled = [...joined.matchAll(SPELLED_NUMBER_RE)]
        .filter((m) => !/\d/.test(joined.slice(Math.max(0, m.index! - 15), m.index!)))
        .map((m) => m[0]);
      if (spelled.length > 0) {
        warnings.push(
          `hallazgo "${beat.finding}": cifras escritas con letra (${[...new Set(spelled)].join(", ")}) — ` +
            `el guardián de cifras no las revisa`
        );
      }

      accepted = candidate;
    }

    if (accepted) body.push(accepted);
  }

  if (body.length === 0) {
    throw new Error(
      `ningún hallazgo sobrevivió al guardián de cifras. Rechazos: ${rejections.join(" | ") || "(el modelo no devolvió JSON válido)"}`
    );
  }

  // Trim from the end if the calibration was not enough. The outline is ordered by narrative
  // importance, so the last findings are the cheapest to lose -- and losing one is much better
  // than shipping the length problem this format exists to solve.
  let kept = body;
  const sizeOf = (bs: DialogueTurn[][]) =>
    overhead + bs.reduce((n, g) => n + g.reduce((m, t) => m + t.text.length, 0), 0);
  while (kept.length > MIN_BEATS && sizeOf(kept) > MAX_CHARS) {
    kept = kept.slice(0, -1);
    warnings.push(`se recortó un hallazgo del final: el episodio pasaba de ${MAX_CHARS} caracteres`);
  }

  const turns = mergeWithin([opening, ...kept, closing]);
  const characters =
    turns.reduce((n, t) => n + t.text.length, 0) + coldOpen.reduce((n, t) => n + t.text.length, 0);

  return {
    coldOpen,
    turns,
    topic,
    beats: beats.length,
    characters,
    estimatedMinutes: Number((characters / CHARS_PER_MINUTE).toFixed(1)),
    warnings,
  };
}

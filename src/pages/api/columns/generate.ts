import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { buildVoiceContext, voicePromptBlock } from "../../../lib/brand-voice";
import { retrieveLearningContext } from "../../../lib/brand-learning";
import { generateRecraftImage } from "../../../lib/recraft-image";

// Same register as the hand-written column briefs (generate-images.ts) — editorial illustration,
// never Larry/Orange Rhino, which is the social-brand-post mascot identity.
const IMAGE_NEGATIVE_PROMPT = "text, letters, words, numbers, watermark, logo, signature, mascot, cartoon rhino, ugly, blurry";

async function proposeCoverPrompt(title: string, subtitle: string, bodyText: string): Promise<string | null> {
  const prompt = `Vas a describir, EN INGLÉS y en UNA sola línea, la imagen de portada editorial para esta columna de opinión tech. Debe ser una escena o metáfora visual conceptual (no un diagrama, no texto/letras/números en la imagen, no personas reconocibles, sin logos), estilo "editorial illustration", que capture la idea central de la pieza.

Título: "${title}"${subtitle ? `\nSubtítulo: "${subtitle}"` : ""}
Extracto: "${bodyText.slice(0, 600)}"

Responde SOLO la descripción de la imagen en inglés, sin comillas, sin explicación, terminando con: "clean professional editorial illustration style, no text"`;
  const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 150 });
  const raw: string = typeof result?.response === "string" ? result.response : "";
  return raw.trim() || null;
}

export const prerender = false;

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base || "columna";
  let n = 2;
  while (await env.DB.prepare("SELECT id FROM columns WHERE slug = ?").bind(candidate).first()) {
    candidate = `${base}-${n}`;
    n++;
  }
  return candidate;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Same delimiter-based philosophy as translate.ts's translateColumn: asking the model for JSON
// containing a long HTML-ish body is exactly what broke JSON.parse on several locales earlier
// this session (unescaped quotes in the generated text). A plain marker format has nothing to
// escape, so generation is parsed the same safe way translation already is.
function parseGenerated(raw: string): { title: string; subtitle: string; bodyHtml: string } | null {
  // [ \t]* (not \s*) after the label — \s* would cross the newline into the next line's
  // content whenever the value is left empty, e.g. capturing "BODY:" as the subtitle text.
  const titleMatch = raw.match(/TITLE:[ \t]*(.+)/);
  const subtitleMatch = raw.match(/SUBTITLE:[ \t]*(.*)/);
  const bodyIdx = raw.indexOf("BODY:");
  if (!titleMatch || bodyIdx === -1) return null;

  const title = titleMatch[1].trim();
  const subtitle = (subtitleMatch?.[1] ?? "").trim();
  const bodyRaw = raw.slice(bodyIdx + "BODY:".length).trim();

  const lines = bodyRaw.split("\n");
  const htmlParts: string[] = [];
  let paragraphBuf: string[] = [];
  let listBuf: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuf.length) {
      htmlParts.push(`<p>${esc(paragraphBuf.join(" ").trim())}</p>`);
      paragraphBuf = [];
    }
  };
  const flushList = () => {
    if (listBuf.length) {
      htmlParts.push(`<ul>\n${listBuf.map((li) => `<li>${esc(li)}</li>`).join("\n")}\n</ul>`);
      listBuf = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    const h2 = line.match(/^\[H2\]\s*(.+)/);
    if (h2) {
      flushParagraph();
      flushList();
      htmlParts.push(`<h2>${esc(h2[1].trim())}</h2>`);
      continue;
    }
    const li = line.match(/^[-•]\s*(.+)/);
    if (li) {
      flushParagraph();
      listBuf.push(li[1].trim());
      continue;
    }
    flushList();
    paragraphBuf.push(line);
  }
  flushParagraph();
  flushList();

  const bodyHtml = htmlParts.join("\n");
  if (!bodyHtml) return null;
  return { title, subtitle, bodyHtml };
}

async function factCheckColumn(bodyText: string, bioFacts: any) {
  const prompt = `Revisa esta columna de opinión que se va a publicar a nombre de Esteban Rey. Compárala SOLO contra estos hechos verificados:\n${JSON.stringify(bioFacts)}\n\nColumna:\n"${bodyText.slice(0, 3000)}"\n\n¿La columna inventa algún logro, fecha, cifra o dato específico y verificable sobre Esteban o sus empresas que NO esté respaldado por los hechos de arriba? (Ignora opiniones generales sobre la industria/tecnología — esas no necesitan estar en los hechos). Responde SOLO un JSON: {"grounded": true|false, "issue": "descripción breve si grounded es false, si no cadena vacía"}`;
  const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 200 });
  const raw: string = typeof result?.response === "string" ? result.response : JSON.stringify(result?.response ?? "");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { grounded: true, issue: "" };
  try {
    return JSON.parse(match[0]);
  } catch {
    return { grounded: true, issue: "" };
  }
}

// Exported as a plain function, same convention as runGenerate/runReshare/runPublish, so a
// future cron/tick can call it in-process — no self-fetch hop to time out on.
export async function runGenerateColumn(topicId?: number) {
  let topic: any;
  if (topicId) {
    topic = await env.DB.prepare("SELECT * FROM brand_topics WHERE id = ? AND active = 1").bind(topicId).first();
  } else {
    topic = await env.DB.prepare("SELECT * FROM brand_topics WHERE active = 1 ORDER BY RANDOM() LIMIT 1").first();
  }
  if (!topic) return { error: "no active topic found" };

  const { voiceSamples, bioFacts, columnVoiceSamples } = await buildVoiceContext(env.DB);
  const voiceBlock = voicePromptBlock(voiceSamples, bioFacts, columnVoiceSamples);
  const learningBlock = await retrieveLearningContext(topic.label, topic.description ?? "");

  const prompt = `${voiceBlock}

${learningBlock}

Vas a escribir una COLUMNA DE OPINIÓN completa y larga (no un post corto de redes sociales) a nombre de Esteban Rey, con el mismo registro y estructura de sus columnas de ejemplo de arriba: título fuerte, 3-6 secciones con encabezado, párrafos sustanciosos, y un cierre con reflexión u opinión propia. Español, tono directo y técnico cuando aplique, primera persona.

Tema: "${topic.label}" — ${topic.description}

Responde EXACTAMENTE en este formato, sin texto adicional antes o después, sin markdown de bloque de código:
TITLE: <título de la columna>
SUBTITLE: <subtítulo breve, opcional, deja vacío después de "SUBTITLE:" si no aplica>
BODY:
[H2] <primer encabezado de sección>
<párrafo>
<párrafo>
[H2] <segundo encabezado>
<párrafo>
- <si hay una lista, cada punto en su propia línea empezando con "-">
<párrafo de cierre>`;

  const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 3000 });
  const raw: string = typeof result?.response === "string" ? result.response : JSON.stringify(result?.response ?? "");
  const parsed = parseGenerated(raw);
  if (!parsed || !parsed.title || !parsed.bodyHtml) {
    return { error: "generation failed to parse", rawLength: raw.length };
  }

  const bodyText = parsed.bodyHtml.replace(/<[^>]+>/g, " ");
  const check = await factCheckColumn(bodyText, bioFacts);
  const rejectionNote = check.grounded === false ? `fact-check: ${check.issue}` : null;

  const slug = await uniqueSlug(slugify(parsed.title));
  const today = new Date().toISOString().slice(0, 10);

  // Cover image is best-effort — a failed/slow image call shouldn't block the text draft from
  // landing in the approval queue at all.
  let coverKey: string | null = null;
  try {
    const coverPrompt = await proposeCoverPrompt(parsed.title, parsed.subtitle, bodyText);
    if (coverPrompt) {
      coverKey = await generateRecraftImage(coverPrompt, { style: "digital_illustration", negativePrompt: IMAGE_NEGATIVE_PROMPT });
    }
  } catch (err) {
    console.error("Column cover image generation failed:", err);
  }

  const displaySeed = 1000 + Math.floor(Math.random() * 9000);
  const res = await env.DB.prepare(
    `INSERT INTO columns (slug, title, subtitle, body_html, published_at, status, rejection_reason, topic_id, cover_r2_key, display_seed)
     VALUES (?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?, ?)`
  )
    .bind(slug, parsed.title, parsed.subtitle || null, parsed.bodyHtml, today, rejectionNote, topic.id, coverKey, displaySeed)
    .run();

  return {
    ok: true,
    id: res.meta.last_row_id,
    slug,
    title: parsed.title,
    topic: topic.label,
    flagged: !!rejectionNote,
    rejectionNote,
    coverKey,
  };
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const topicId = url.searchParams.get("topicId");
  const result = await runGenerateColumn(topicId ? Number(topicId) : undefined);
  const status = "error" in result ? 502 : 200;
  return new Response(JSON.stringify(result), { status, headers: { "content-type": "application/json" } });
};

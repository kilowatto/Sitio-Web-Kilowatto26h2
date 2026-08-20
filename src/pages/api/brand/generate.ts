import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { buildVoiceContext, voicePromptBlock } from "../../../lib/brand-voice";
import { retrieveLearningContext } from "../../../lib/brand-learning";
import { proposeImage } from "../../../lib/brand-image";

export const prerender = false;

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const PLATFORM_GUIDANCE: Record<string, string> = {
  x: "Máximo ~260 caracteres. Directo, sin relleno. Evita incluir un link salvo que sea imprescindible (cada link cuesta más al publicar). Puede ser una opinión fuerte, un dato técnico, o un comentario corto.",
  linkedin: "Entre 400 y 1200 caracteres. Puede tener 2-4 párrafos cortos, un gancho fuerte en la primera línea (LinkedIn corta el texto ahí), y cerrar con una reflexión o pregunta abierta. Tono profesional pero humano, nunca corporativo-genérico.",
};

async function callAI(prompt: string, maxTokens: number) {
  const result: any = await env.AI.run(MODEL, {
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
  });
  if (result?.response && typeof result.response === "object") return result.response;
  const raw: string = typeof result?.response === "string" ? result.response : "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// Safety net independent of the prompt instruction — seen live (2026-07-20) generating
// hashtags in the separate `hashtags` field AND duplicating them inline at the end of
// `content`, which would double them up at publish time. Hashtags reliably cluster at the
// very end of a post, so stripping a trailing run of #word tokens is safe.
function stripTrailingHashtags(text: string): string {
  return text.replace(/(\s*#[\wÀ-ÿ]+)+\s*$/u, "").trim();
}

async function factCheck(content: string, bioFacts: any) {
  const prompt = `Revisa este post que se va a publicar en redes sociales a nombre de Esteban Rey. Compáralo SOLO contra estos hechos verificados:\n${JSON.stringify(bioFacts)}\n\nPost:\n"${content}"\n\n¿El post inventa algún logro, fecha, cifra o dato que NO esté respaldado por los hechos de arriba o que sea de conocimiento general verificable? Responde SOLO un JSON: {"grounded": true|false, "issue": "descripción breve si grounded es false, si no cadena vacía"}`;
  const result = await callAI(prompt, 200);
  return result ?? { grounded: true, issue: "" };
}

// Exported as a plain function so tick.ts can call it directly in-process instead of
// self-fetching its own public URL — see the note on runReshare() in reshare.ts for why
// that chain of nested self-fetches was silently killing the autopilot cadence (522s).
export async function runGenerate(body: { platform: "x" | "linkedin"; language: string; topicId?: number; variantCount?: number }) {
  // Default is 2 (A/B test) for the normal autopilot cadence — the "generar nuevos desde
  // cero" button in /admin/social asks for 1 per platform instead, so it produces exactly
  // one fresh draft per network rather than an A/B pair.
  const variantCount = body.variantCount && body.variantCount > 0 ? body.variantCount : 2;

  let topic: any;
  if (body.topicId) {
    topic = await env.DB.prepare("SELECT * FROM brand_topics WHERE id = ? AND active = 1").bind(body.topicId).first();
  } else {
    topic = await env.DB.prepare("SELECT * FROM brand_topics WHERE active = 1 ORDER BY RANDOM() LIMIT 1").first();
  }
  if (!topic) {
    return { error: "no active topic found" };
  }

  const { voiceSamples, bioFacts, columnVoiceSamples } = await buildVoiceContext(env.DB);
  const voiceBlock = voicePromptBlock(voiceSamples, bioFacts, columnVoiceSamples);
  // Vector-retrieved, not a flat SQL dump — only feedback semantically relevant to THIS
  // topic comes back, instead of the last N rejections/edits regardless of subject.
  const learningBlock = await retrieveLearningContext(topic.label, topic.description ?? "");

  const prompt = `${voiceBlock}

${learningBlock}

Tema para este post: "${topic.label}" — ${topic.description}
Plataforma: ${body.platform}. ${PLATFORM_GUIDANCE[body.platform]}
Idioma: ${body.language === "en" ? "inglés" : "español"}.

Genera EXACTAMENTE ${variantCount} variante${variantCount > 1 ? "s distintas del mismo post (para prueba A/B)" : " de este post"}, cada una con un "gancho" (hook) diferente entre: pregunta, dato/estadística o hecho concreto, anécdota/historia corta, opinión directa/contrarian.

Los hashtags van SOLO en el campo "hashtags", nunca escritos dentro de "content" — "content" es el texto del post tal cual se publicaría, sin ningún "#" en ningún lado. Cada variante lleva ${body.platform === "x" ? "máximo 2" : "máximo 3"} hashtags contextuales específicos al contenido real del post (nunca genéricos tipo #tech). NO incluyas hashtags de marca fijos (#Kilowatto, #IgniaCloud) — esos se agregan aparte automáticamente.

Responde SOLO un JSON:
{"variants": [{"style": "nombre del gancho usado", "content": "texto del post SIN hashtags", "hashtags": ["#Ejemplo1", "#Ejemplo2"]}, {"style": "...", "content": "...", "hashtags": [...]}]}`;

  const generated = await callAI(prompt, 900);
  const variants: { style: string; content: string; hashtags?: string[] }[] = generated?.variants ?? [];
  if (variants.length === 0) {
    return { error: "generation failed, no variants produced" };
  }

  const variantGroup = crypto.randomUUID();
  const inserted: any[] = [];
  // One shared image per variant group (A/B tests the copy, not the picture) — tries an
  // approved real photo matching the topic first, only generates via AI if nothing fits.
  const imageKey = await proposeImage(topic.label, variants[0]?.content ?? topic.label, undefined, topic.image_style);

  for (const v of variants) {
    if (!v?.content) continue;
    const cleanContent = stripTrailingHashtags(v.content);
    const check = await factCheck(cleanContent, bioFacts);
    const rejectionNote = check.grounded === false ? `fact-check: ${check.issue}` : null;

    const res = await env.DB.prepare(
      `INSERT INTO brand_posts (platform, kind, topic_id, language, content, variant_group, variant_style, status, rejection_reason, image_r2_key, hashtags)
       VALUES (?, 'idea', ?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?)`
    )
      .bind(
        body.platform,
        topic.id,
        body.language,
        cleanContent,
        variantGroup,
        v.style ?? null,
        rejectionNote,
        imageKey,
        (v.hashtags ?? []).join(" ") || null
      )
      .run();

    inserted.push({ id: res.meta.last_row_id, style: v.style, content: cleanContent, flagged: !!rejectionNote, imageKey });
  }

  return { ok: true, topic: topic.label, variantGroup, inserted };
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json<{ platform: "x" | "linkedin"; language: string; topicId?: number; variantCount?: number }>();
  if (!body?.platform || !body?.language) {
    return new Response(JSON.stringify({ error: "missing platform or language" }), { status: 400 });
  }

  const result = await runGenerate(body);
  const status = "error" in result ? (result.error === "no active topic found" ? 400 : 502) : 200;
  return new Response(JSON.stringify(result), { status, headers: { "content-type": "application/json" } });
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { buildVoiceContext, voicePromptBlock } from "../../../lib/brand-voice";

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

async function factCheck(content: string, bioFacts: any) {
  const prompt = `Revisa este post que se va a publicar en redes sociales a nombre de Esteban Rey. Compáralo SOLO contra estos hechos verificados:\n${JSON.stringify(bioFacts)}\n\nPost:\n"${content}"\n\n¿El post inventa algún logro, fecha, cifra o dato que NO esté respaldado por los hechos de arriba o que sea de conocimiento general verificable? Responde SOLO un JSON: {"grounded": true|false, "issue": "descripción breve si grounded es false, si no cadena vacía"}`;
  const result = await callAI(prompt, 200);
  return result ?? { grounded: true, issue: "" };
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json<{ platform: "x" | "linkedin"; language: string; topicId?: number }>();
  if (!body?.platform || !body?.language) {
    return new Response(JSON.stringify({ error: "missing platform or language" }), { status: 400 });
  }

  let topic: any;
  if (body.topicId) {
    topic = await env.DB.prepare("SELECT * FROM brand_topics WHERE id = ? AND active = 1").bind(body.topicId).first();
  } else {
    topic = await env.DB.prepare("SELECT * FROM brand_topics WHERE active = 1 ORDER BY RANDOM() LIMIT 1").first();
  }
  if (!topic) {
    return new Response(JSON.stringify({ error: "no active topic found" }), { status: 400 });
  }

  const { voiceSamples, bioFacts } = await buildVoiceContext(env.DB);
  const voiceBlock = voicePromptBlock(voiceSamples, bioFacts);

  const prompt = `${voiceBlock}

Tema para este post: "${topic.label}" — ${topic.description}
Plataforma: ${body.platform}. ${PLATFORM_GUIDANCE[body.platform]}
Idioma: ${body.language === "en" ? "inglés" : "español"}.

Genera EXACTAMENTE 2 variantes distintas del mismo post (para prueba A/B), cada una con un "gancho" (hook) diferente entre: pregunta, dato/estadística o hecho concreto, anécdota/historia corta, opinión directa/contrarian. Responde SOLO un JSON:
{"variants": [{"style": "nombre del gancho usado", "content": "texto del post"}, {"style": "...", "content": "..."}]}`;

  const generated = await callAI(prompt, 900);
  const variants: { style: string; content: string }[] = generated?.variants ?? [];
  if (variants.length === 0) {
    return new Response(JSON.stringify({ error: "generation failed, no variants produced" }), { status: 502 });
  }

  const variantGroup = crypto.randomUUID();
  const inserted: any[] = [];

  for (const v of variants) {
    if (!v?.content) continue;
    const check = await factCheck(v.content, bioFacts);
    const rejectionNote = check.grounded === false ? `fact-check: ${check.issue}` : null;

    const res = await env.DB.prepare(
      `INSERT INTO brand_posts (platform, kind, topic_id, language, content, variant_group, variant_style, status, rejection_reason)
       VALUES (?, 'idea', ?, ?, ?, ?, ?, 'pending_approval', ?)`
    )
      .bind(body.platform, topic.id, body.language, v.content, variantGroup, v.style ?? null, rejectionNote)
      .run();

    inserted.push({ id: res.meta.last_row_id, style: v.style, content: v.content, flagged: !!rejectionNote });
  }

  return new Response(JSON.stringify({ ok: true, topic: topic.label, variantGroup, inserted }), {
    headers: { "content-type": "application/json" },
  });
};

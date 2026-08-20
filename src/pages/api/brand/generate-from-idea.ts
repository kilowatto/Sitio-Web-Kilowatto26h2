import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { buildVoiceContext, voicePromptBlock } from "../../../lib/brand-voice";
import { webSearch } from "../../../lib/web-search";
import { createShortLink } from "../../../lib/short-links";
import { generateLarryScene } from "../../../lib/brand-image";

export const prerender = false;

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

async function callAI(prompt: string, maxTokens: number) {
  const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens });
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

async function factCheck(content: string, bioFacts: any, researchSummary: string) {
  const prompt = `Revisa este post que se va a publicar en redes sociales a nombre de Esteban Rey. Compáralo contra estos hechos verificados sobre él:\n${JSON.stringify(bioFacts)}\n\nY contra esta investigación web real que se usó para redactarlo:\n${researchSummary}\n\nPost:\n"${content}"\n\n¿El post inventa algún dato, cifra o afirmación que NO esté respaldado por los hechos verificados NI por la investigación de arriba? Responde SOLO un JSON: {"grounded": true|false, "issue": "descripción breve si grounded es false, si no cadena vacía"}`;
  const result = await callAI(prompt, 200);
  return result ?? { grounded: true, issue: "" };
}

// The "compositor con investigación" — Esteban gives a rough idea, this searches the web
// for real current information, writes the post grounded in what it found (citing sources
// as tracked short links), and illustrates it with Larry doing something concretely tied to
// the idea. Goes through the same approval queue as everything else — never auto-publishes.
export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json<{ idea: string; platform: "x" | "linkedin" | "both"; scheduledFor?: string }>();
  const idea = body?.idea?.trim();
  if (!idea) return new Response(JSON.stringify({ error: "falta idea" }), { status: 400 });
  const platforms: ("x" | "linkedin")[] = body.platform === "both" ? ["x", "linkedin"] : [body.platform ?? "x"];

  const results = await webSearch(idea, 5);
  const researchSummary = results.length
    ? results.map((r, i) => `[${i + 1}] ${r.title} — ${r.snippet} (${r.url})`).join("\n")
    : "(sin resultados de búsqueda — usa solo conocimiento general, sin inventar cifras específicas)";

  const { voiceSamples, bioFacts } = await buildVoiceContext(env.DB);
  const voiceBlock = voicePromptBlock(voiceSamples, bioFacts);

  const created: any[] = [];

  for (const platform of platforms) {
    const limit = platform === "x" ? "máximo ~260 caracteres" : "400-1200 caracteres, 2-4 párrafos cortos";
    const hashtagLimit = platform === "x" ? 2 : 3;

    const prompt = `${voiceBlock}

Esteban te dio esta idea para un post: "${idea}"

Investigación web real sobre el tema (úsala para que el post tenga información actual y precisa, cita solo lo que esté aquí, no inventes cifras/fechas que no aparezcan):
${researchSummary}

Escribe el post para ${platform}. ${limit}. Usa la investigación de arriba para dar contexto real y actualizado, en el tono de Esteban. Si citas un dato específico de una fuente, indica a cuál con su número entre corchetes, ej. [1].

Los hashtags van SOLO en el campo "hashtags", nunca escritos dentro de "content". Incluye hasta ${hashtagLimit} hashtags contextuales específicos.

Responde SOLO un JSON: {"content": "texto del post SIN hashtags, con [1] [2] etc. donde cites una fuente", "hashtags": ["#Ejemplo1"], "citedSources": [1, 2]}`;

    const generated = await callAI(prompt, 700);
    if (!generated?.content) continue;

    let content: string = generated.content;
    const hashtags: string[] = generated.hashtags ?? [];
    const citedIndices: number[] = Array.isArray(generated.citedSources) ? generated.citedSources : [];

    const check = await factCheck(content, bioFacts, researchSummary);
    const rejectionNote = check.grounded === false ? `fact-check: ${check.issue}` : null;

    // Insert first (empty sources) to get a real id for short links to reference, then
    // replace each [N] marker with a tracked kilowatto.com/r/xxxx link and update.
    const insertRes = await env.DB.prepare(
      `INSERT INTO brand_posts (platform, kind, language, content, status, rejection_reason, idea_prompt, scheduled_for)
       VALUES (?, 'idea', 'es', ?, 'pending_approval', ?, ?, ?)`
    )
      .bind(platform, content, rejectionNote, idea, body.scheduledFor ?? null)
      .run();
    const postId = insertRes.meta.last_row_id as number;

    const usedSources: { title: string; url: string; shortUrl: string }[] = [];
    for (const idx of citedIndices) {
      const source = results[idx - 1];
      if (!source) continue;
      const shortUrl = await createShortLink(source.url, postId);
      content = content.replaceAll(`[${idx}]`, shortUrl);
      usedSources.push({ title: source.title, url: source.url, shortUrl });
    }

    const imageKey = await generateLarryScene(idea, researchSummary);

    await env.DB.prepare("UPDATE brand_posts SET content = ?, hashtags = ?, sources = ?, image_r2_key = ? WHERE id = ?")
      .bind(content, hashtags.join(" ") || null, JSON.stringify(usedSources), imageKey, postId)
      .run();

    created.push({ id: postId, platform, content, sources: usedSources, imageKey, flagged: !!rejectionNote });
  }

  return new Response(JSON.stringify({ ok: true, created }), { headers: { "content-type": "application/json" } });
};

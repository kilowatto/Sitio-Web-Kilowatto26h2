// Auto-generates a grounded FAQ set per investigación (5-8 Q&A), for two reasons: a real
// visible FAQ section for readers, and FAQPage JSON-LD -- the explicit GEO goal in
// docs/investigaciones-spec.md ("Traducción e idiomas": AI Overviews/answer engines should be
// able to cite these). Grounded strictly in the piece's own body/summary/sources, same
// no-new-facts constraint generate-posts.ts already uses for social copy.
import { env } from "cloudflare:workers";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function htmlToPlain(html: string, maxLen: number): string {
  const text = html.replace(/<!--chart:[^>]+-->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

async function callAI(env: any, prompt: string): Promise<{ faqs: { question: string; answer: string }[] } | null> {
  const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 3000 });
  const raw: string = typeof result?.response === "string" ? result.response : JSON.stringify(result?.response ?? "");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function generateFaqsFor(
  env: any,
  investigacion: { title: string; summary: string; body_html: string },
  sourcesBlock: string
): Promise<{ question: string; answer: string }[]> {
  const bodyPlain = htmlToPlain(investigacion.body_html, 8000);
  const prompt = `Esta es una investigación periodística de A Fondo con Kilowatto (por Esteban Rey): "${investigacion.title}"
Resumen: ${investigacion.summary}

Cuerpo completo (o un extracto largo):
${bodyPlain}

Fuentes citadas:
${sourcesBlock}

Genera entre 5 y 8 preguntas frecuentes (FAQ) que un lector -- o un motor de búsqueda/IA respondiendo una pregunta relacionada -- razonablemente haría sobre este tema, con sus respuestas. USA SOLO información que aparezca en el texto de arriba -- NUNCA inventes cifras, fechas o afirmaciones que no estén respaldadas ahí. Cada respuesta debe ser autocontenida (tiene sentido leída sola, fuera de contexto), directa, entre 1 y 3 frases, citando datos concretos del texto cuando aplique. Las preguntas deben ser variadas (no todas empiecen igual) y cubrir los ángulos más probables de búsqueda sobre el tema, no solo repetir el resumen.

Responde SOLO un JSON:
{"faqs": [{"question": "¿...?", "answer": "..."}, ...]}`;

  const generated = await callAI(env, prompt);
  const faqs = generated?.faqs ?? [];
  return faqs.filter((f) => !!f?.question && !!f?.answer);
}

export async function runGenerateFaqs(investigacionId: number): Promise<{ error?: string; count?: number }> {
  const investigacion = await env.DB.prepare("SELECT title, summary, body_html FROM investigaciones WHERE id = ?")
    .bind(investigacionId)
    .first<any>();
  if (!investigacion) return { error: "investigación no encontrada" };

  const sourcesRes = await env.DB.prepare(
    "SELECT label, url, confidence FROM investigacion_sources WHERE investigacion_id = ? ORDER BY position LIMIT 30"
  )
    .bind(investigacionId)
    .all<any>();
  const sourcesBlock = (sourcesRes.results ?? []).map((s: any) => `- ${s.label} (${s.confidence})`).join("\n") || "(sin fuentes registradas)";

  const faqs = await generateFaqsFor(env, investigacion, sourcesBlock);
  if (faqs.length === 0) return { error: "generation failed, no FAQs produced" };

  await env.DB.prepare("DELETE FROM investigacion_faqs WHERE investigacion_id = ?").bind(investigacionId).run();
  for (let i = 0; i < faqs.length; i++) {
    await env.DB.prepare(
      "INSERT INTO investigacion_faqs (investigacion_id, position, question, answer_html) VALUES (?, ?, ?, ?)"
    )
      .bind(investigacionId, i, faqs[i].question, `<p>${faqs[i].answer}</p>`)
      .run();
  }
  return { count: faqs.length };
}

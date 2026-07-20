import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { FORBIDDEN_TOPICS_NOTE } from "../../../../lib/brand-voice";

export const prerender = false;

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Brainstorm helper, not a save — returns candidate topics for Esteban to edit/discard
// before any of them become a real brand_topics row (via the existing POST /api/brand/topics).
export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json<{ seed: string }>();
  const seed = body?.seed?.trim();
  if (!seed) return new Response(JSON.stringify({ error: "falta seed" }), { status: 400 });

  const existing = await env.DB.prepare("SELECT label FROM brand_topics").all<any>();
  const existingLabels = (existing.results ?? []).map((r: any) => r.label).join(", ");

  const prompt = `Eres un estratega de contenido para redes sociales de Esteban Rey ("Kilowatto"), CEO de Ignia Cloud, fundador del Yucatech Festival e inversionista (Orange Rhino Investments).

Ideas semilla que dio Esteban: "${seed}"

Temas que YA existen (no los repitas): ${existingLabels || "ninguno todavía"}

${FORBIDDEN_TOPICS_NOTE}

A partir de las ideas semilla, genera 8 temas/pilares de contenido relacionados y específicos (no genéricos) que Larry podría usar para redactar posts. Cada uno con una etiqueta corta (label) y una descripción de una oración (description) explicando de qué trataría el contenido. Responde SOLO un JSON:
{"suggestions": [{"label": "...", "description": "..."}, ...]}`;

  const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 900 });
  let suggestions: any[] = [];
  if (result?.response && typeof result.response === "object") {
    suggestions = result.response.suggestions ?? [];
  } else if (typeof result?.response === "string") {
    const match = result.response.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        suggestions = JSON.parse(match[0])?.suggestions ?? [];
      } catch {
        suggestions = [];
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, suggestions }), { headers: { "content-type": "application/json" } });
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { webSearch } from "../../../../../lib/web-search";

export const prerender = false;

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// "Revisar vigencia" — a topic like "Kimi K3" can go stale the day "Kimi K4" ships. The model
// doing this check (llama-3.3-70b) has a training cutoff that predates whatever AI models/
// products a topic references today — it has NO real knowledge of them, and confirmed live
// (twice) that just TELLING it "don't invent things, quote real evidence" isn't enough: it kept
// fabricating plausible-sounding but nonexistent products ("GPT-5.6 Sol", "Claude Fable 5",
// "ChatGPT Work", "Opus 5" as an Anthropic response to "OpenAI y China") even after being told
// not to. Prompt-only guardrails don't work on this model for this task — so this version makes
// the model point at a SPECIFIC search result by index and quote a short exact phrase from it,
// then VERIFIES server-side (plain substring check, not another LLM call) that the phrase
// actually appears in that result's title/snippet before trusting "stale: true" at all. If the
// quote isn't really there, the verdict is forced back to false, no exceptions.
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const topic = await env.DB.prepare("SELECT * FROM brand_topics WHERE id = ?").bind(params.id).first<any>();
  if (!topic) return new Response(JSON.stringify({ error: "tema no encontrado" }), { status: 404 });

  const results = await webSearch(`${topic.label} ${topic.description ?? ""}`.trim(), 5, false, "pm");

  let review: any = { stale: false, reason: "Sin resultados de búsqueda recientes — no se puede confirmar que esté desactualizado.", sourceUrl: "" };

  if (results.length) {
    const researchSummary = results.map((r, i) => `[${i + 1}] ${r.title} — ${r.snippet}`).join("\n");

    const prompt = `Eres un editor que revisa temas de contenido para redes sociales, buscando que no queden desactualizados (ej: un tema sobre "Kimi K3" que debería actualizarse a "Kimi K4" en cuanto sale una versión nueva).

Tema actual:
Etiqueta: "${topic.label}"
Descripción: "${topic.description ?? ""}"

Resultados de búsqueda reciente (último mes), numerados:
${researchSummary}

Reglas ESTRICTAS:
1. Marca "stale": true SOLO si uno de los resultados numerados de arriba menciona TEXTUALMENTE un nombre, versión o fecha más reciente que reemplace lo que dice el tema.
2. "evidenceIndex" debe ser el número exacto (1-${results.length}) del resultado que respalda tu decisión. "evidenceQuote" debe ser una frase corta (5-12 palabras) COPIADA LITERALMENTE de ese resultado — ni una palabra distinta.
3. Si no hay ningún resultado que respalde un cambio real, responde "stale": false y deja "evidenceQuote" vacío. La ausencia de información NUNCA es evidencia de que algo está desactualizado.
4. Ante la duda, responde "stale": false.

Responde SOLO un JSON:
{"stale": true|false, "evidenceIndex": 0, "evidenceQuote": "", "reason": "explicación breve"}`;

    const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 300 });
    let parsed: any = null;
    if (result?.response && typeof result.response === "object") {
      parsed = result.response;
    } else if (typeof result?.response === "string") {
      const match = result.response.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }

    if (parsed) {
      const idx = Number(parsed.evidenceIndex) - 1;
      const source = results[idx];
      const quote = typeof parsed.evidenceQuote === "string" ? parsed.evidenceQuote.trim() : "";
      // The actual verification: does the quoted phrase really appear in that result's own
      // text? Not "does it sound plausible" — a literal (accent/case-insensitive) substring
      // check against the title+snippet the model was actually given.
      const verified = !!source && !!quote && normalize(`${source.title} ${source.snippet}`).includes(normalize(quote));

      if (parsed.stale && verified) {
        review = { stale: true, reason: parsed.reason || quote, evidenceQuote: quote, sourceUrl: source.url, sourceTitle: source.title };
      } else if (parsed.stale && !verified) {
        review = { stale: false, reason: "El modelo propuso un cambio pero no se pudo verificar contra los resultados reales — descartado automáticamente.", sourceUrl: "" };
      } else {
        review = { stale: false, reason: parsed.reason || "Sigue vigente.", sourceUrl: "" };
      }
    }
  }

  await env.DB.prepare("UPDATE brand_topics SET last_reviewed_at = ?, stale_flag = ?, review_note = ? WHERE id = ?")
    .bind(new Date().toISOString(), review.stale ? 1 : 0, review.stale ? `${review.reason}\n${review.sourceUrl ?? ""}` : "", params.id)
    .run();

  return new Response(JSON.stringify({ ok: true, ...review }), { headers: { "content-type": "application/json" } });
};

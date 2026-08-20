import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { buildVoiceContext, voicePromptBlock } from "../../../lib/brand-voice";
import { proposeImage } from "../../../lib/brand-image";

export const prerender = false;

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Same safety net as generate.ts — the model sometimes duplicates hashtags inline at the
// end of content even when told they belong only in the separate field.
function stripTrailingHashtags(text: string): string {
  return text.replace(/(\s*#[\wÀ-ÿ]+)+\s*$/u, "").trim();
}

// Reshares of already-published press mentions skip human approval (per Esteban's
// explicit call) — the underlying news item already went through /admin/prensa review,
// this only adds a short reaction on top of something a human already vetted.
//
// Exported as a plain function (not just the POST handler below) so tick.ts can call it
// directly in-process. tick.ts used to chain this via a self-fetch to its own public URL —
// confirmed live (2026-07-20/21) that chain of nested self-fetches (reshare -> generate x2
// -> publish), each now genuinely slow with real Gemini image calls, kept exceeding
// Cloudflare's edge timeout and coming back as a bare "error code: 522", silently killing
// the whole autopilot cadence for over a day. Direct calls have no HTTP hop to time out on.
export async function runReshare() {
  const { results: mentions } = await env.DB.prepare(
    `SELECT * FROM press_mentions
     WHERE status = 'published'
       AND url NOT IN (SELECT source_url FROM brand_posts WHERE source_url IS NOT NULL)
     ORDER BY published_at DESC LIMIT 5`
  ).all<any>();

  if (!mentions || mentions.length === 0) {
    return { ok: true, created: 0, items: [] };
  }

  const { voiceSamples, bioFacts } = await buildVoiceContext(env.DB);
  const voiceBlock = voicePromptBlock(voiceSamples, bioFacts);

  const created: any[] = [];

  for (const m of mentions) {
    for (const platform of ["x", "linkedin"] as const) {
      const limit = platform === "x" ? "máximo ~250 caracteres" : "300-600 caracteres, 1-2 párrafos";
      const hashtagLimit = platform === "x" ? 2 : 3;
      const prompt = `${voiceBlock}

Esta mención de prensa ya fue revisada y aprobada por Esteban:
Título: ${m.title}
Medio: ${m.outlet}
Resumen: ${m.summary}
URL: ${m.url}

Escribe un post breve para ${platform} compartiendo/reaccionando a esta nota, en primera persona, con el tono real de Esteban. ${limit}. No repitas el título literal, agrega una reflexión o contexto propio breve.

Los hashtags van SOLO en el campo "hashtags", nunca escritos dentro de "content". Incluye hasta ${hashtagLimit} hashtags contextuales específicos (no genéricos, no de marca — esos se agregan aparte). Responde SOLO un JSON: {"content": "texto del post SIN hashtags", "hashtags": ["#Ejemplo1"]}`;

      const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 400 });
      const raw = typeof result?.response === "object" ? result.response : null;
      let content: string | null = raw?.content ?? null;
      let hashtags: string[] = raw?.hashtags ?? [];
      if (!content && typeof result?.response === "string") {
        const match = result.response.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            content = parsed?.content ?? null;
            hashtags = parsed?.hashtags ?? [];
          } catch {
            content = null;
          }
        }
      }
      if (!content) continue;
      const cleanContent = stripTrailingHashtags(content);

      const imageKey = await proposeImage(m.title ?? "", cleanContent);

      const res = await env.DB.prepare(
        `INSERT INTO brand_posts (platform, kind, language, content, source_url, status, image_r2_key, hashtags)
         VALUES (?, 'news_reshare', 'es', ?, ?, 'approved', ?, ?)`
      )
        .bind(platform, cleanContent, m.url, imageKey, hashtags.join(" ") || null)
        .run();

      created.push({ id: res.meta.last_row_id, platform, content: cleanContent, source: m.url, imageKey });
    }
  }

  return { ok: true, created: created.length, items: created };
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await runReshare();
  return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
};

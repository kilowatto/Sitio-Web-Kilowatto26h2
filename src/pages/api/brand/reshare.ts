import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { buildVoiceContext, voicePromptBlock } from "../../../lib/brand-voice";

export const prerender = false;

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Reshares of already-published press mentions skip human approval (per Esteban's
// explicit call) — the underlying news item already went through /admin/prensa review,
// this only adds a short reaction on top of something a human already vetted.
export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const { results: mentions } = await env.DB.prepare(
    `SELECT * FROM press_mentions
     WHERE status = 'published'
       AND url NOT IN (SELECT source_url FROM brand_posts WHERE source_url IS NOT NULL)
     ORDER BY published_at DESC LIMIT 5`
  ).all<any>();

  if (!mentions || mentions.length === 0) {
    return new Response(JSON.stringify({ ok: true, created: 0 }), { headers: { "content-type": "application/json" } });
  }

  const { voiceSamples, bioFacts } = await buildVoiceContext(env.DB);
  const voiceBlock = voicePromptBlock(voiceSamples, bioFacts);

  const created: any[] = [];

  for (const m of mentions) {
    for (const platform of ["x", "linkedin"] as const) {
      const limit = platform === "x" ? "máximo ~250 caracteres" : "300-600 caracteres, 1-2 párrafos";
      const prompt = `${voiceBlock}

Esta mención de prensa ya fue revisada y aprobada por Esteban:
Título: ${m.title}
Medio: ${m.outlet}
Resumen: ${m.summary}
URL: ${m.url}

Escribe un post breve para ${platform} compartiendo/reaccionando a esta nota, en primera persona, con el tono real de Esteban. ${limit}. No repitas el título literal, agrega una reflexión o contexto propio breve. Responde SOLO un JSON: {"content": "texto del post"}`;

      const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 400 });
      const raw = typeof result?.response === "object" ? result.response : null;
      let content: string | null = raw?.content ?? null;
      if (!content && typeof result?.response === "string") {
        const match = result.response.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            content = JSON.parse(match[0])?.content ?? null;
          } catch {
            content = null;
          }
        }
      }
      if (!content) continue;

      const res = await env.DB.prepare(
        `INSERT INTO brand_posts (platform, kind, language, content, source_url, status)
         VALUES (?, 'news_reshare', 'es', ?, ?, 'approved')`
      )
        .bind(platform, content, m.url)
        .run();

      created.push({ id: res.meta.last_row_id, platform, content, source: m.url });
    }
  }

  return new Response(JSON.stringify({ ok: true, created: created.length, items: created }), {
    headers: { "content-type": "application/json" },
  });
};

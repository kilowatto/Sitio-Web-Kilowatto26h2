import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { generateInvestigacionImage } from "../../../../lib/investigacion-image";

export const prerender = false;

// One editorial illustration (Gemini/"nano banana") per chart section, shown
// beside its data visualization -- the chart itself stays hand-coded
// SVG/CSS (see docs/investigaciones-spec.md), this is purely decorative.
// Same token gate as generate-cover.ts.
export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const investigacionId = Number(params.id);
  const body = await request.json<{ chartKey?: string; prompt?: string }>().catch(() => ({}) as any);
  if (!body.chartKey) return new Response(JSON.stringify({ error: "chartKey required" }), { status: 400 });

  const row = await env.DB.prepare(
    "SELECT id, title, description FROM investigacion_charts WHERE investigacion_id = ? AND chart_key = ?"
  )
    .bind(investigacionId, body.chartKey)
    .first<any>();
  if (!row) return new Response(JSON.stringify({ error: "chart not found" }), { status: 404 });

  const prompt =
    body.prompt ||
    `Editorial illustration for a data journalism piece, illustrating: "${row.title}". ${row.description ?? ""} Conceptual metaphor, no text, no letters, no numbers, no logos, no recognizable people, clean professional editorial illustration style, warm amber and deep orange color palette, cinematic lighting.`;

  const r2Key = await generateInvestigacionImage(prompt);
  if (!r2Key) return new Response(JSON.stringify({ error: "image generation failed" }), { status: 502 });

  await env.DB.prepare("UPDATE investigacion_charts SET image_r2_key = ? WHERE id = ?").bind(r2Key, row.id).run();

  return new Response(JSON.stringify({ ok: true, image_r2_key: r2Key }), { headers: { "content-type": "application/json" } });
};

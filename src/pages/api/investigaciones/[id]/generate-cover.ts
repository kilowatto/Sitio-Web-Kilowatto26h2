import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { generateInvestigacionImage } from "../../../../lib/investigacion-image";

export const prerender = false;

// Cover (and, later, per-section) imagery for "A fondo" pieces uses Gemini, not Recraft --
// Esteban's explicit choice (docs/investigaciones-spec.md). Token-gated the same way the
// photo pipeline is: ADMIN_TOKEN from the browser, or SCRATCH_TOKEN for Claude to call this
// directly without going through /admin.
export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const id = Number(params.id);
  const row = await env.DB.prepare("SELECT id, title, summary FROM investigaciones WHERE id = ?").bind(id).first<any>();
  if (!row) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });

  const body = await request.json<{ prompt?: string }>().catch(() => ({}) as any);
  const prompt =
    body.prompt ||
    `Editorial illustration for a deep investigative tech/business piece titled "${row.title}". ${row.summary?.slice(0, 300) ?? ""} Conceptual metaphor, no text, no letters, no numbers, no logos, no recognizable people, clean professional editorial illustration style, warm amber and deep orange color palette, sense of investigation and uncovering hidden truth, cinematic lighting.`;

  const r2Key = await generateInvestigacionImage(prompt);
  if (!r2Key) return new Response(JSON.stringify({ error: "image generation failed" }), { status: 502 });

  await env.DB.prepare("UPDATE investigaciones SET cover_r2_key = ? WHERE id = ?").bind(r2Key, id).run();

  return new Response(JSON.stringify({ ok: true, cover_r2_key: r2Key }), { headers: { "content-type": "application/json" } });
};

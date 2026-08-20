import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { generateRecraftImage } from "../../../lib/recraft-image";

export const prerender = false;

// General-purpose one-off asset generator for site design work (banners, silhouettes,
// illustrations) — not tied to any one content type like columns/photos. Admin-token gated,
// returns the R2 key directly so it can be wired into a page immediately.
export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ prompt: string; style?: string; model?: string; negativePrompt?: string; size?: string }>();
  if (!body?.prompt) return new Response(JSON.stringify({ error: "falta prompt" }), { status: 400 });

  const key = await generateRecraftImage(body.prompt, {
    style: body.style as any,
    model: body.model as any,
    negativePrompt: body.negativePrompt,
    size: body.size,
  });
  if (!key) return new Response(JSON.stringify({ error: "generación fallida" }), { status: 502 });

  return new Response(JSON.stringify({ ok: true, key, url: `https://kilowatto.com/media/${key}` }), {
    headers: { "content-type": "application/json" },
  });
};

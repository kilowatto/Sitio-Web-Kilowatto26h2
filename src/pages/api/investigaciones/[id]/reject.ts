import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const id = params.id;
  const body = await request.json<{ reason?: string }>().catch(() => ({}) as any);

  const current = await env.DB.prepare("SELECT id FROM investigaciones WHERE id = ?").bind(id).first<any>();
  if (!current) return new Response("not found", { status: 404 });

  await env.DB.prepare(`UPDATE investigaciones SET status = 'rejected', rejection_reason = COALESCE(?, rejection_reason) WHERE id = ?`)
    .bind(body?.reason || null, id)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

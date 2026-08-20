import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ reason?: string }>().catch(() => ({}) as any);
  await env.DB.prepare("UPDATE comments SET status = 'rejected', rejection_reason = ? WHERE id = ?")
    .bind(body.reason || null, params.id)
    .run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

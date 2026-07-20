import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json<{ reason?: string }>().catch(() => ({}) as any);

  // Reason is genuinely optional (Esteban's call — forcing it every time kills the habit
  // of using it at all) — store NULL when absent so buildLearningContext's filter treats
  // it as "no signal" instead of feeding a meaningless placeholder back into future prompts.
  await env.DB.prepare(`UPDATE brand_posts SET status = 'rejected', rejection_reason = ? WHERE id = ?`)
    .bind(body?.reason || null, params.id)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Pulls an already-approved (and therefore possibly already public) photo back to pending
// for a fresh look — reversible, unlike delete.ts.
export const POST: APIRoute = async ({ params, request }) => {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  await env.DB.prepare("UPDATE photos SET approval_status = 'pending', approved_at = NULL WHERE id = ?")
    .bind(params.id)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

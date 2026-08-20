import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  if (new URL(request.url).searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  // Hard structural guard, not just a UI convention — rows the weekly briefing (weekly-briefing.ts)
  // flagged as matching a private family name can never be published through this endpoint,
  // full stop, regardless of admin token. If a genuinely public row is ever mis-flagged, fix the
  // flag directly in D1 rather than adding a bypass here.
  const row = await env.DB.prepare("SELECT is_family_private FROM press_mentions WHERE id = ?").bind(params.id).first<any>();
  if (row?.is_family_private) {
    return new Response(JSON.stringify({ error: "family_private_blocked" }), { status: 403 });
  }

  await env.DB.prepare("UPDATE press_mentions SET status = 'published', approved_at = datetime('now') WHERE id = ?")
    .bind(params.id)
    .run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

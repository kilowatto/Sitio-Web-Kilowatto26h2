import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Manual override for the rotating hero photo — auto-selection (solo_subject=1) stays
// the fallback when nothing is manually marked, see the homepage query.
export const POST: APIRoute = async ({ params, request }) => {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ isProfilePhoto: boolean }>();

  await env.DB.prepare("UPDATE photos SET is_profile_photo = ? WHERE id = ?")
    .bind(body.isProfilePhoto ? 1 : 0, params.id)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

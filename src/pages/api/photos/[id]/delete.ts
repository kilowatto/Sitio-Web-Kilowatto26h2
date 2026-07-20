import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Real deletion — R2 object + D1 row gone for good. Distinct from reject.ts (which just
// flips approval_status, keeping the file around) because Esteban specifically needs to
// be able to permanently remove a photo that was mistakenly approved (e.g. contains a
// minor), not just hide it.
export const POST: APIRoute = async ({ params, request }) => {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const photo = await env.DB.prepare("SELECT r2_key FROM photos WHERE id = ?").bind(params.id).first<any>();
  if (!photo) return new Response("not found", { status: 404 });

  await env.MEDIA.delete(photo.r2_key);
  await env.DB.prepare("DELETE FROM photos WHERE id = ?").bind(params.id).run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

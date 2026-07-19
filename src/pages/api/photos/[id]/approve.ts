import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const photo = await env.DB.prepare("SELECT minor_flag, approval_status FROM photos WHERE id = ?")
    .bind(params.id)
    .first<any>();
  if (!photo) return new Response("not found", { status: 404 });

  // Double lock: a "flagged" (possible minor / uncertain) photo needs the explicit ?confirm=si
  // param on top of the token, per the site's privacy rules — never a single click to publish.
  const confirmed = url.searchParams.get("confirm") === "si";
  if (photo.minor_flag === "flagged" && !confirmed) {
    return new Response(
      JSON.stringify({ error: "Esta foto está marcada como posible menor — requiere confirmación explícita." }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
  }

  await env.DB.prepare(
    "UPDATE photos SET approval_status = 'approved', approved_at = datetime('now') WHERE id = ?"
  )
    .bind(params.id)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getSessionUserId } from "../../../../lib/session";
import { verifyRegistration } from "../../../../lib/webauthn";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const userId = await getSessionUserId(cookies, env);
  if (!userId) return new Response("unauthorized", { status: 401 });

  const body = await request.json<{ response: any; nickname?: string }>();
  try {
    await verifyRegistration(env, userId, body.response, body.nickname);
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), { status: 400 });
  }
};

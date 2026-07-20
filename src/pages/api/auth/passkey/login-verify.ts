import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyAuthentication } from "../../../../lib/webauthn";
import { createSession, setSessionCookie } from "../../../../lib/session";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json<{ response: any }>();
  try {
    const userId = await verifyAuthentication(env, body.response);
    const token = await createSession(env, userId);
    setSessionCookie(cookies, token);
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), { status: 400 });
  }
};

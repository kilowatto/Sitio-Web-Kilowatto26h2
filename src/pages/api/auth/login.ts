import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyPassword } from "../../../lib/crypto";
import { createSession, setSessionCookie } from "../../../lib/session";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json<{ email: string; password: string }>().catch(() => null);
  if (!body?.email || !body?.password) {
    return new Response(JSON.stringify({ error: "faltan credenciales" }), { status: 400 });
  }

  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(body.email.toLowerCase().trim()).first<any>();
  if (!user) {
    return new Response(JSON.stringify({ error: "credenciales inválidas" }), { status: 401 });
  }

  const valid = await verifyPassword(body.password, user.password_hash, user.password_salt);
  if (!valid) {
    return new Response(JSON.stringify({ error: "credenciales inválidas" }), { status: 401 });
  }

  const token = await createSession(env, user.id);
  setSessionCookie(cookies, token);

  return new Response(JSON.stringify({ ok: true, mustChangePassword: !!user.must_change_password }), {
    headers: { "content-type": "application/json" },
  });
};

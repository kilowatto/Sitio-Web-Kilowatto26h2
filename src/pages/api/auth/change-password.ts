import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyPassword, hashPassword } from "../../../lib/crypto";
import { getSessionUserId } from "../../../lib/session";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const userId = await getSessionUserId(cookies, env);
  if (!userId) return new Response("unauthorized", { status: 401 });

  const body = await request.json<{ currentPassword: string; newPassword: string }>().catch(() => null);
  if (!body?.currentPassword || !body?.newPassword) {
    return new Response(JSON.stringify({ error: "faltan campos" }), { status: 400 });
  }
  if (body.newPassword.length < 12) {
    return new Response(JSON.stringify({ error: "la nueva contraseña debe tener al menos 12 caracteres" }), { status: 400 });
  }

  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<any>();
  const valid = await verifyPassword(body.currentPassword, user.password_hash, user.password_salt);
  if (!valid) {
    return new Response(JSON.stringify({ error: "la contraseña actual no es correcta" }), { status: 401 });
  }

  const { hash, salt } = await hashPassword(body.newPassword);
  await env.DB.prepare(
    `UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(hash, salt, userId)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

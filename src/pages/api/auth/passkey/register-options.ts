import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getSessionUserId } from "../../../../lib/session";
import { buildRegistrationOptions } from "../../../../lib/webauthn";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const userId = await getSessionUserId(cookies, env);
  if (!userId) return new Response("unauthorized", { status: 401 });

  const user = await env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(userId).first<any>();
  const options = await buildRegistrationOptions(env, userId, user.email);
  return new Response(JSON.stringify(options), { headers: { "content-type": "application/json" } });
};

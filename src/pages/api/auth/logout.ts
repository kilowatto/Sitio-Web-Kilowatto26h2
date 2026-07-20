import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { destroySession } from "../../../lib/session";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  await destroySession(cookies, env);
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

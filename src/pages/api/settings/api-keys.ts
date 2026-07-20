import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getSessionUserId } from "../../../lib/session";
import { encryptSetting } from "../../../lib/crypto";

export const prerender = false;

const KEYS = ["X_BEARER_TOKEN", "LINKEDIN_ACCESS_TOKEN", "LINKEDIN_PERSON_URN"];

export const GET: APIRoute = async ({ cookies }) => {
  const userId = await getSessionUserId(cookies, env);
  if (!userId) return new Response("unauthorized", { status: 401 });

  const { results } = await env.DB.prepare("SELECT key, updated_at FROM brand_api_settings").all<any>();
  const set = new Map((results ?? []).map((r: any) => [r.key, r.updated_at]));
  const status = KEYS.map((k) => ({ key: k, configured: set.has(k), updatedAt: set.get(k) ?? null }));

  return new Response(JSON.stringify({ status }), { headers: { "content-type": "application/json" } });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const userId = await getSessionUserId(cookies, env);
  if (!userId) return new Response("unauthorized", { status: 401 });

  const body = await request.json<Record<string, string>>();
  for (const key of KEYS) {
    const value = body[key];
    if (!value) continue;
    const encrypted = await encryptSetting(env, value);
    await env.DB.prepare(
      `INSERT INTO brand_api_settings (key, encrypted_value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET encrypted_value = excluded.encrypted_value, updated_at = datetime('now')`
    )
      .bind(key, encrypted)
      .run();
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

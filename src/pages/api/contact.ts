import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body: any = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";

  // Honeypot — a real visitor never fills a field named this; only bots that blindly fill
  // every input do. Silently pretend success so the bot doesn't learn to avoid the field.
  if (body.website) {
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }

  if (!name || !email || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "invalid" }), { status: 400 });
  }

  // Simple per-IP rate limit (5/hour) — cheap spam guard until Turnstile is set up.
  const rateKey = `contact_rate:${clientAddress ?? "unknown"}`;
  const count = parseInt((await env.KILOWATTO_KV.get(rateKey)) ?? "0", 10);
  if (count >= 5) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
  }
  await env.KILOWATTO_KV.put(rateKey, String(count + 1), { expirationTtl: 3600 });

  await env.DB.prepare("INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)").bind(name, email, message).run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

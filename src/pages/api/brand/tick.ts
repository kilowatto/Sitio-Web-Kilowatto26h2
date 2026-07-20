import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Single orchestration entrypoint the cron hits every ~30min: top up the idea queue,
// draft any new news reshares, then attempt to publish whatever's due. Daily caps and
// the kill switch both live in publish.ts so this stays a thin dispatcher.
const QUEUE_TARGET: Record<string, number> = { x: 3, linkedin: 1 };

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const base = url.origin;
  const results: Record<string, any> = {};

  try {
    const reshareRes = await fetch(`${base}/api/brand/reshare?token=${token}`, { method: "POST" });
    results.reshare = await reshareRes.json();
  } catch (err: any) {
    results.reshare = { error: String(err?.message ?? err) };
  }

  for (const platform of ["x", "linkedin"] as const) {
    const pending = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM brand_posts WHERE platform = ? AND status = 'pending_approval'`
    )
      .bind(platform)
      .first<any>();
    if ((pending?.n ?? 0) < QUEUE_TARGET[platform]) {
      try {
        const genRes = await fetch(`${base}/api/brand/generate?token=${token}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ platform, language: "es" }),
        });
        results[`generate_${platform}`] = await genRes.json();
      } catch (err: any) {
        results[`generate_${platform}`] = { error: String(err?.message ?? err) };
      }
    }
  }

  try {
    const pubRes = await fetch(`${base}/api/brand/publish?token=${token}`, { method: "POST" });
    results.publish = await pubRes.json();
  } catch (err: any) {
    results.publish = { error: String(err?.message ?? err) };
  }

  return new Response(JSON.stringify({ ok: true, results }), { headers: { "content-type": "application/json" } });
};

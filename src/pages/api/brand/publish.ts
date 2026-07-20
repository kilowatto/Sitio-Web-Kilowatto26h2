import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { publishPost, getSetting } from "../../../lib/social-publish";

export const prerender = false;

const DAILY_LIMIT: Record<string, number> = { x: 5, linkedin: 1 };
const KILL_SWITCH_KEY = "brand_autopilot_paused";

async function countPostedToday(platform: string) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM brand_posts WHERE platform = ? AND status = 'posted' AND date(posted_at) = date('now')`
  )
    .bind(platform)
    .first<any>();
  return row?.n ?? 0;
}

async function recordMetrics(brandPostId: number, platform: string, externalId: string) {
  if (platform !== "x") return; // LinkedIn metrics endpoint not wired yet
  const bearerToken = await getSetting(env, "X_BEARER_TOKEN");
  if (!bearerToken) return;
  try {
    const res = await fetch(`https://api.x.com/2/tweets/${externalId}?tweet.fields=public_metrics`, {
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    if (!res.ok) return;
    const data: any = await res.json();
    const m = data?.data?.public_metrics;
    if (!m) return;
    await env.DB.prepare(
      `INSERT INTO brand_post_metrics (brand_post_id, impressions, likes, comments, shares) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(brandPostId, m.impression_count ?? 0, m.like_count ?? 0, m.reply_count ?? 0, m.retweet_count ?? 0)
      .run();

    env.BRAND_ANALYTICS?.writeDataPoint({
      blobs: [platform, String(brandPostId)],
      doubles: [m.impression_count ?? 0, m.like_count ?? 0, m.reply_count ?? 0, m.retweet_count ?? 0],
      indexes: [platform],
    });
  } catch (err) {
    console.error("recordMetrics failed:", err);
  }
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const paused = await env.KILOWATTO_KV.get(KILL_SWITCH_KEY);
  if (paused === "true") {
    return new Response(JSON.stringify({ ok: true, skipped: "paused" }), { headers: { "content-type": "application/json" } });
  }

  const published: any[] = [];

  for (const platform of ["x", "linkedin"] as const) {
    const postedToday = await countPostedToday(platform);
    if (postedToday >= DAILY_LIMIT[platform]) continue;

    const next = await env.DB.prepare(
      `SELECT * FROM brand_posts
       WHERE platform = ? AND status = 'approved'
         AND (scheduled_for IS NULL OR scheduled_for <= datetime('now'))
       ORDER BY created_at ASC LIMIT 1`
    )
      .bind(platform)
      .first<any>();
    if (!next) continue;

    const result = await publishPost(env, platform, next.content);
    if (result.ok) {
      await env.DB.prepare(
        `UPDATE brand_posts SET status = 'posted', posted_at = datetime('now'), external_post_id = ?, external_url = ? WHERE id = ?`
      )
        .bind(result.externalId ?? null, result.externalUrl ?? null, next.id)
        .run();
      published.push({ id: next.id, platform, externalUrl: result.externalUrl });
    } else {
      await env.DB.prepare(`UPDATE brand_posts SET status = 'failed', rejection_reason = ? WHERE id = ?`)
        .bind(result.error ?? "unknown error", next.id)
        .run();
      published.push({ id: next.id, platform, error: result.error });
    }
  }

  const { results: toMeasure } = await env.DB.prepare(
    `SELECT id, platform, external_post_id FROM brand_posts
     WHERE status = 'posted' AND external_post_id IS NOT NULL
       AND posted_at <= datetime('now', '-1 hour') AND posted_at >= datetime('now', '-7 days')`
  ).all<any>();
  for (const p of toMeasure ?? []) {
    await recordMetrics(p.id, p.platform, p.external_post_id);
  }

  return new Response(JSON.stringify({ ok: true, published, measured: toMeasure?.length ?? 0 }), {
    headers: { "content-type": "application/json" },
  });
};

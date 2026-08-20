import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { maybeSnapshotFollowers } from "../../../lib/follower-snapshot";
import { recordUnderperformingPosts } from "../../../lib/underperformance";
import { runReshare } from "./reshare";
import { runGenerate } from "./generate";
import { runPublish } from "./publish";
import { proposeNewsReactions, expireStaleNewsReactions } from "../../../lib/news-reaction-pipeline";
import { runNewsAutoPublish } from "../../../lib/news-reaction-trust";

export const prerender = false;

// Single orchestration entrypoint the cron hits every ~30min: top up the idea queue,
// draft any new news reshares, then attempt to publish whatever's due. Daily caps and
// the kill switch both live in publish.ts so this stays a thin dispatcher.
//
// Calls reshare/generate/publish DIRECTLY as in-process functions, not via self-fetch to
// this Worker's own public URL (as it used to). That nested self-fetch chain — tick ->
// reshare -> generate(x) -> generate(linkedin) -> publish, each hop going back out through
// Cloudflare's edge — kept exceeding the edge's connection timeout once image generation
// started making real Gemini calls (each several seconds), coming back as a bare
// "error code: 522" and silently killing the whole autopilot cadence for over a day
// (confirmed live 2026-07-20/21, zero auto-generated posts between then and 2026-07-21).
// Direct calls have no HTTP hop to time out on.
const QUEUE_TARGET: Record<string, number> = { x: 3, linkedin: 1 };

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const results: Record<string, any> = {};

  try {
    results.reshare = await runReshare();
  } catch (err: any) {
    results.reshare = { error: String(err?.message ?? err) };
  }

  const platformsToGenerate: Array<"x" | "linkedin"> = [];
  for (const platform of ["x", "linkedin"] as const) {
    const pending = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM brand_posts WHERE platform = ? AND status = 'pending_approval'`
    )
      .bind(platform)
      .first<any>();
    if ((pending?.n ?? 0) < QUEUE_TARGET[platform]) platformsToGenerate.push(platform);
  }

  // Independent per platform — safe to run concurrently, and cuts this step's wall-clock
  // roughly in half versus awaiting them one at a time.
  await Promise.all(
    platformsToGenerate.map(async (platform) => {
      try {
        results[`generate_${platform}`] = await runGenerate({ platform, language: "es" });
      } catch (err: any) {
        results[`generate_${platform}`] = { error: String(err?.message ?? err) };
      }
    })
  );

  try {
    results.news_reactions = await proposeNewsReactions();
  } catch (err: any) {
    results.news_reactions = { error: String(err?.message ?? err) };
  }

  try {
    results.expired_news = await expireStaleNewsReactions();
  } catch (err: any) {
    results.expired_news = { error: String(err?.message ?? err) };
  }

  try {
    results.publish = await runPublish();
  } catch (err: any) {
    results.publish = { error: String(err?.message ?? err) };
  }

  try {
    results.news_auto_publish = await runNewsAutoPublish();
  } catch (err: any) {
    results.news_auto_publish = { error: String(err?.message ?? err) };
  }

  await maybeSnapshotFollowers(env).catch((err) => console.error("follower snapshot failed:", err));
  await recordUnderperformingPosts(env).catch((err) => console.error("underperformance scan failed:", err));

  // Powers the "salud del sistema" widget on /admin — the only record of "is the cron
  // actually running" that existed before this was reading raw wrangler tail logs.
  await env.KILOWATTO_KV.put("last_tick_at", new Date().toISOString()).catch(() => {});

  return new Response(JSON.stringify({ ok: true, results }), { headers: { "content-type": "application/json" } });
};

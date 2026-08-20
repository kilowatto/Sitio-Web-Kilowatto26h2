import { env } from "cloudflare:workers";
import { publishBrandPost } from "../pages/api/brand/publish";

const NEWS_AUTOPILOT_PAUSE_KEY = "news_autopilot_paused";
const TRUST_THRESHOLD = 10;
// Hard daily ceilings for AUTO-published news reactions specifically (separate from the
// general per-platform posting limit in publish.ts). LinkedIn's is deliberately harder to
// reach in practice, not just a lower number — see the variant_style filter below.
const AUTO_PUBLISH_CAP: Record<string, number> = { x: 5, linkedin: 3 };

export async function isNewsAutopilotPaused(): Promise<boolean> {
  return (await env.KILOWATTO_KV.get(NEWS_AUTOPILOT_PAUSE_KEY)) === "true";
}

export async function setNewsAutopilotPaused(paused: boolean) {
  await env.KILOWATTO_KV.put(NEWS_AUTOPILOT_PAUSE_KEY, paused ? "true" : "false");
}

export async function getTrust(platform: "x" | "linkedin") {
  return env.DB.prepare("SELECT * FROM news_reaction_trust WHERE platform = ?").bind(platform).first<any>();
}

// Called when a news_reaction post is approved WITHOUT any edit to its content — the
// "clean approval" signal. At the threshold, autopilot flips on for that platform
// automatically (Esteban's call: it should just start working once it's earned it, not
// wait for him to flip a switch — the dedicated panic switch above is the way back out).
export async function recordCleanApproval(platform: "x" | "linkedin") {
  const trust = await getTrust(platform);
  const next = (trust?.consecutive_clean_approvals ?? 0) + 1;
  const autopilotEnabled = next >= TRUST_THRESHOLD ? 1 : trust?.autopilot_enabled ?? 0;
  await env.DB.prepare(
    "UPDATE news_reaction_trust SET consecutive_clean_approvals = ?, autopilot_enabled = ?, updated_at = datetime('now') WHERE platform = ?"
  )
    .bind(next, autopilotEnabled, platform)
    .run();
}

// Any edit-before-approve or reject of a news_reaction post resets the streak to zero AND
// turns autopilot back off if it was on — a bad call has to re-earn the full streak again
// rather than just losing a little progress, since this is the one thing on the site that
// can post without a human looking at it first.
export async function recordTrustReset(platform: "x" | "linkedin") {
  await env.DB.prepare(
    "UPDATE news_reaction_trust SET consecutive_clean_approvals = 0, autopilot_enabled = 0, updated_at = datetime('now') WHERE platform = ?"
  )
    .bind(platform)
    .run();
}

async function countAutoPublishedToday(platform: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM brand_posts WHERE platform = ? AND auto_published = 1 AND date(posted_at) = date('now')`
  )
    .bind(platform)
    .first<any>();
  return row?.n ?? 0;
}

export async function runNewsAutoPublish() {
  if (await isNewsAutopilotPaused()) {
    return { ok: true, skipped: "news autopilot paused" };
  }

  const published: any[] = [];

  for (const platform of ["x", "linkedin"] as const) {
    const trust = await getTrust(platform);
    if (!trust?.autopilot_enabled) continue;

    const cap = AUTO_PUBLISH_CAP[platform];
    const postedToday = await countAutoPublishedToday(platform);
    if (postedToday >= cap) continue;

    // LinkedIn's professional register + Esteban's explicit "muy raras ocasiones" call means
    // it only auto-publishes the more formal, citation-backed variant — never the casual one.
    const styleFilter = platform === "linkedin" ? "AND variant_style = 'formal_con_cita'" : "";

    const { results } = await env.DB.prepare(
      `SELECT * FROM brand_posts
       WHERE platform = ? AND kind = 'news_reaction' AND status = 'pending_approval' AND never_auto = 0
         AND (expires_at IS NULL OR expires_at > datetime('now'))
         ${styleFilter}
       ORDER BY created_at ASC LIMIT ?`
    )
      .bind(platform, cap - postedToday)
      .all<any>();

    for (const post of results ?? []) {
      const result = await publishBrandPost(post, platform, true);
      published.push({ id: post.id, platform, ok: result.ok, externalUrl: result.externalUrl, content: post.content.slice(0, 100) });
    }
  }

  return { ok: true, published };
}

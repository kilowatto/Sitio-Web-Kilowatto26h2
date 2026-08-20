import { env } from "cloudflare:workers";
import { searchCandidates, classifyCandidate, countTodaysNewsReactions, platformWithFewerToday, DAILY_CAP } from "./tech-news";
import { generateNewsReactionPost } from "./news-reaction";

// Called every tick — searches, classifies, and drafts news-reaction proposals up to the
// daily cap. Always runs regardless of the news-autopilot (auto-PUBLISH) toggle: proposing
// for Esteban's approval and auto-publishing once trusted are two separate concerns.
export async function proposeNewsReactions() {
  const created: any[] = [];
  let todaysCount = await countTodaysNewsReactions();
  if (todaysCount >= DAILY_CAP) {
    return { ok: true, created, skipped: "daily cap reached" };
  }

  const candidates = await searchCandidates();

  for (const candidate of candidates) {
    if (todaysCount >= DAILY_CAP) break;

    const classification = await classifyCandidate(candidate);
    if (!classification) continue;
    if (!classification.relevant) continue;
    if (!candidate.isBrandTopic && !classification.bigLaunchWorthy) continue;

    const platform = await platformWithFewerToday();
    const result = await generateNewsReactionPost(candidate, classification, platform);
    if (result) {
      created.push(result);
      todaysCount++;
    }
  }

  return { ok: true, created };
}

// Moves stale pending_approval news_reaction posts to 'expired' — NOT a rejection signal
// (Esteban's call: it aged out on timing, not because the content/style was bad, so it
// must never feed the "what doesn't work" RAG the way an actual reject does).
export async function expireStaleNewsReactions() {
  const res = await env.DB.prepare(
    `UPDATE brand_posts SET status = 'expired'
     WHERE kind = 'news_reaction' AND status = 'pending_approval' AND expires_at IS NOT NULL AND expires_at < datetime('now')`
  ).run();
  return { expired: res.meta.changes ?? 0 };
}

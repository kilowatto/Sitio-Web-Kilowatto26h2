import { env } from "cloudflare:workers";

// Assigns a real scheduled_for to approved posts instead of leaving it NULL --
// previously NULL just meant "post whenever the next cron tick has room," which
// silently produced a plain FIFO-by-creation-order queue with zero regard for when
// a post actually performs best. This re-learns the best day-of-week/hour slots
// from real posted history + brand_post_metrics every time it's called, so it keeps
// tuning itself as more engagement data comes in -- there's no separate "retrain" step.

export const DAILY_LIMIT: Record<string, number> = { x: 5, linkedin: 1 };

// Reasonable priors used only until a platform has enough real posted-and-measured
// history to trust (see MIN_SAMPLES_PER_BUCKET) -- common social-media-timing wisdom,
// hours in America/Mexico_City local time. Gets replaced by real data automatically.
const FALLBACK_HOURS: Record<string, number[]> = {
  x: [9, 12, 17, 20],
  linkedin: [8, 9],
};

const MIN_SAMPLES_PER_BUCKET = 5;

// Plausible posting windows per platform (America/Mexico_City local hour) -- the learned
// ranking only ever picks WITHIN these, it never expands outside them. Without this bound,
// an early bucket with only a handful of samples can look like the "best" slot purely by
// chance (e.g. one post that happened to go out at 2am and got a few likes) and the
// scheduler would happily start booking posts at 2am. Real timing wisdom stays the outer
// fence; the learning only refines WHERE inside it to post.
const PLAUSIBLE_HOURS: Record<string, [number, number]> = {
  x: [7, 22],
  linkedin: [7, 19],
};

export interface SlotScore {
  dow: number; // 0=Sunday .. 6=Saturday, America/Mexico_City local
  hour: number; // 0-23, America/Mexico_City local
  score: number; // avg weighted engagement (likes + comments*2 + shares*3) for posts in this bucket
  samples: number;
}

// Weighted so a comment (a stronger engagement signal) counts more than a like, and a
// share more still -- a simple, defensible proxy given we don't have GA4-grade
// attention metrics for social posts.
export async function getBestSlots(platform: "x" | "linkedin"): Promise<SlotScore[]> {
  const rows = await env.DB.prepare(
    `SELECT
       CAST(strftime('%w', datetime(bp.posted_at, '-6 hours')) AS INTEGER) AS dow,
       CAST(strftime('%H', datetime(bp.posted_at, '-6 hours')) AS INTEGER) AS hour,
       COUNT(*) AS samples,
       AVG(COALESCE(m.likes, 0) + COALESCE(m.comments, 0) * 2 + COALESCE(m.shares, 0) * 3) AS score
     FROM brand_posts bp
     LEFT JOIN (
       SELECT brand_post_id, MAX(fetched_at) AS latest_fetch FROM brand_post_metrics GROUP BY brand_post_id
     ) lm ON lm.brand_post_id = bp.id
     LEFT JOIN brand_post_metrics m ON m.brand_post_id = lm.brand_post_id AND m.fetched_at = lm.latest_fetch
     WHERE bp.platform = ? AND bp.status = 'posted' AND bp.posted_at IS NOT NULL
     GROUP BY dow, hour
     HAVING samples >= ? AND hour BETWEEN ? AND ?
     ORDER BY score DESC`
  )
    .bind(platform, MIN_SAMPLES_PER_BUCKET, PLAUSIBLE_HOURS[platform]?.[0] ?? 7, PLAUSIBLE_HOURS[platform]?.[1] ?? 21)
    .all();
  return (rows.results ?? []) as unknown as SlotScore[];
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// Picks the next real future slot for `platform`, respecting the daily posting cap.
// `reserved` lets a caller run this in a loop (e.g. backfilling many posts at once)
// without everything landing on the same day -- pass the same Map across calls and
// this reserves the slot it picks into it.
export async function assignSmartSchedule(
  platform: "x" | "linkedin",
  reserved: Map<string, number> = new Map()
): Promise<string> {
  const ranked = await getBestSlots(platform);
  const rankedHours = ranked.length > 0 ? ranked : null;
  const cap = DAILY_LIMIT[platform] ?? 1;

  // How many of this platform's posts already occupy each future day (scheduled or
  // posted), so a freshly-assigned slot doesn't blow past the daily cap.
  const existing = await env.DB.prepare(
    `SELECT date(COALESCE(scheduled_for, posted_at)) AS day, COUNT(*) AS n
     FROM brand_posts
     WHERE platform = ? AND status IN ('approved', 'posted')
       AND COALESCE(scheduled_for, posted_at) > datetime('now')
     GROUP BY day`
  )
    .bind(platform)
    .all<{ day: string; n: number }>();
  const dayCounts = new Map<string, number>((existing.results ?? []).map((r) => [r.day, r.n]));

  // 400 days: at DAILY_LIMIT.linkedin=1 this comfortably outlasts any realistic
  // approved-post backlog. A 60-day bound previously caused a real bug -- once the
  // backlog filled all 60 future days, every call in a batch exhausted the loop and
  // fell through to the identical "tomorrow" fallback below, clustering every post
  // in the batch onto the same instant instead of spreading them out.
  for (let dayOffset = 1; dayOffset <= 400; dayOffset++) {
    const day = new Date(Date.now() + dayOffset * 86_400_000);
    const dayKey = day.toISOString().slice(0, 10);
    const used = (dayCounts.get(dayKey) ?? 0) + (reserved.get(dayKey) ?? 0);
    if (used >= cap) continue;

    const dow = new Date(day.getTime() - 6 * 3600 * 1000).getUTCDay(); // MX-local weekday, matches getBestSlots' bucketing
    const hoursForDow = rankedHours
      ? rankedHours.filter((s) => s.dow === dow).map((s) => s.hour)
      : FALLBACK_HOURS[platform] ?? [10];
    const hours = hoursForDow.length > 0 ? hoursForDow : FALLBACK_HOURS[platform] ?? [10];
    const hour = hours[used % hours.length];

    reserved.set(dayKey, (reserved.get(dayKey) ?? 0) + 1);
    const slot = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour + 6, 0, 0)); // +6h: local MX time -> UTC storage
    return fmt(slot);
  }

  // Extremely unlikely (400 days fully booked at the daily cap) -- fall back to
  // "soon," still spread out via `reserved` so a caller looping this doesn't cluster.
  const fallbackDay = 401 + (reserved.get("__overflow") ?? 0);
  reserved.set("__overflow", (reserved.get("__overflow") ?? 0) + 1);
  return fmt(new Date(Date.now() + fallbackDay * 24 * 60 * 60 * 1000));
}

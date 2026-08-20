import { recordFeedback } from "./brand-learning";

// Second half of the "el RAG que aprenda qué no funciona" loop — the first half
// (recordFeedback on manual reject/edit) already existed. This scans real published
// metrics and feeds genuinely underperforming posts as negative examples too, so the
// generator learns from what actually flopped with real people, not just what Esteban
// rejected before it ever went out.
const MIN_SAMPLE_SIZE = 5; // don't judge "low" against an average built from <5 posts
const UNDERPERFORM_THRESHOLD = 0.5; // flag posts at <50% of the platform's average engagement rate
const STABILIZE_DAYS = 3; // give impressions/likes time to settle before judging a post

function daysAgoISO(days: number) {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export async function recordUnderperformingPosts(env: any) {
  const cutoff = daysAgoISO(STABILIZE_DAYS);

  for (const platform of ["x", "linkedin"] as const) {
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.topic_id, p.content, p.feedback_recorded,
              m.impressions, m.likes, m.comments, m.shares
       FROM brand_posts p
       LEFT JOIN (
         SELECT brand_post_id, impressions, likes, comments, shares,
                ROW_NUMBER() OVER (PARTITION BY brand_post_id ORDER BY fetched_at DESC) AS rn
         FROM brand_post_metrics
       ) m ON m.brand_post_id = p.id AND m.rn = 1
       WHERE p.platform = ? AND p.status = 'posted' AND p.posted_at <= ?
       ORDER BY p.posted_at DESC
       LIMIT 30`
    )
      .bind(platform, cutoff)
      .all<any>();

    const rows = (results ?? []).map((r: any) => ({
      ...r,
      impressions: r.impressions ?? 0,
      engagementRate:
        (r.impressions ?? 0) > 0 ? ((r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0)) / r.impressions : 0,
    }));

    const withImpressions = rows.filter((r: any) => r.impressions > 0);
    if (withImpressions.length < MIN_SAMPLE_SIZE) continue;

    const avgRate = withImpressions.reduce((s: number, r: any) => s + r.engagementRate, 0) / withImpressions.length;
    const pending = rows.filter((r: any) => !r.feedback_recorded && r.impressions > 0);

    for (const r of pending) {
      if (r.engagementRate < avgRate * UNDERPERFORM_THRESHOLD) {
        await recordFeedback({
          type: "low_performance",
          text: `Post: "${r.content.slice(0, 150)}" — ${r.impressions} impresiones, ${(r.engagementRate * 100).toFixed(1)}% de interacción real, muy por debajo del promedio de ${platform} (${(avgRate * 100).toFixed(1)}%).`,
          topicId: r.topic_id,
          platform,
        });
      }
      await env.DB.prepare(`UPDATE brand_posts SET feedback_recorded = 1 WHERE id = ?`).bind(r.id).run();
    }
  }
}

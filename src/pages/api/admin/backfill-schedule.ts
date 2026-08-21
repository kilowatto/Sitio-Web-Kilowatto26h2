import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { assignSmartSchedule } from "../../../lib/post-scheduler";

export const prerender = false;

// One-off (but safe to re-run -- only ever touches scheduled_for IS NULL rows) backfill
// for the approved-posts backlog that predates assignSmartSchedule: those rows were
// approved back when approval left scheduled_for NULL, so the calendar couldn't show
// them and the posting cron just drained them oldest-first with no regard for timing.
export const POST: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const rows = await env.DB.prepare(
    `SELECT id, platform FROM brand_posts WHERE status = 'approved' AND scheduled_for IS NULL ORDER BY created_at ASC`
  ).all<{ id: number; platform: "x" | "linkedin" }>();

  const reserved = new Map<string, number>();
  const updated: { id: number; platform: string; scheduledFor: string }[] = [];
  for (const row of rows.results ?? []) {
    const scheduledFor = await assignSmartSchedule(row.platform, reserved);
    await env.DB.prepare(`UPDATE brand_posts SET scheduled_for = ? WHERE id = ?`).bind(scheduledFor, row.id).run();
    updated.push({ id: row.id, platform: row.platform, scheduledFor });
  }

  return new Response(JSON.stringify({ ok: true, count: updated.length, updated }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};

import { env } from "cloudflare:workers";
import { runClipPost } from "./clip-post";
import { sendAlert } from "./alerts";

// Makes the clips happen on their own, at the cadence Esteban set: five a week.
//
// Same shape as the audio sweep and for the same reasons -- a render takes minutes, a failure
// should heal itself on the next pass, and nothing should wait on it at approve time. Two things
// differ.
//
// First, the cadence is a real limit, not just a cost ceiling. Five a week is what Esteban asked
// for, and a sweep that made every eligible clip at once would burn through the entire backlog in
// a day and then post nothing for a month.
//
// Second, this stays asleep until the render service exists. The container image cannot be built
// on Esteban's machine right now (Docker cannot reach Docker Hub -- see docs/pendientes-esteban.md),
// so RENDER is a binding to a Worker that has not been deployed yet. Rather than fail loudly
// every six hours until then, the sweep reports "sin servicio de render" and does nothing. The
// day the image lands, it starts working with no code change.

const PER_WEEK = 5;
const DEFAULT_LIMIT = 1;
const FAILED_COOLDOWN_HOURS = 24;

const KILL_SWITCH_KEY = "clip_sweep_enabled";
const LAST_RUN_KEY = "clip_sweep_last_run";
const FAILED_KEY = "clip_sweep_failed";

export interface PendingClip {
  entityType: "columna" | "investigacion";
  entityId: number;
  title: string;
}

// Only pieces that already have a clip-worthy chart. A column has no structured data at all --
// its infographic bars are hardcoded per column inside generate-images.ts -- so until that is
// fixed (D2 in the sprint) a column clip would be a hook and a pointer with no numbers, which is
// not worth a render. Investigaciones are the ones with investigacion_charts.
export async function findPendingClips(): Promise<PendingClip[]> {
  const rows = await env.DB.prepare(
    `SELECT i.id, i.title
       FROM investigaciones i
      WHERE i.status = 'published'
        AND EXISTS (
          SELECT 1 FROM investigacion_charts c
           WHERE c.investigacion_id = i.id AND c.chart_type IN ('bar', 'donut', 'funnel')
        )
        AND NOT EXISTS (
          SELECT 1 FROM brand_posts p
           WHERE p.kind = 'clip' AND p.investigacion_id = i.id AND p.variant_style = 'clip:v1'
        )
      ORDER BY i.id ASC`
  ).all<{ id: number; title: string }>();

  const failed: Record<string, string> = JSON.parse((await env.KILOWATTO_KV.get(FAILED_KEY)) ?? "{}");
  const cutoff = Date.now() - FAILED_COOLDOWN_HOURS * 3600 * 1000;

  return (rows.results ?? [])
    .filter((r) => {
      const at = failed[`investigacion:${r.id}`];
      return !at || new Date(at).getTime() < cutoff;
    })
    .map((r) => ({ entityType: "investigacion" as const, entityId: r.id, title: r.title }));
}

async function madeThisWeek(): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(DISTINCT investigacion_id) AS n FROM brand_posts
      WHERE kind = 'clip' AND created_at >= datetime('now', '-7 days')`
  ).first<{ n: number }>();
  return row?.n ?? 0;
}

export interface ClipSweepResult {
  enabled: boolean;
  pending: number;
  thisWeek: number;
  skipped?: string;
  results: { item: PendingClip; ok: boolean; detail: string }[];
}

export async function runClipSweep(limit = DEFAULT_LIMIT): Promise<ClipSweepResult> {
  const enabled = (await env.KILOWATTO_KV.get(KILL_SWITCH_KEY)) !== "0";
  const pending = await findPendingClips();
  const thisWeek = await madeThisWeek();
  const base = { enabled, pending: pending.length, thisWeek, results: [] };

  if (!enabled) return { ...base, skipped: "apagado" };
  if (!(env as any).RENDER) return { ...base, skipped: "sin servicio de render" };
  if (thisWeek >= PER_WEEK) return { ...base, skipped: `ya van ${thisWeek} esta semana` };

  const attempted = pending.slice(0, Math.min(Math.max(0, limit), PER_WEEK - thisWeek));
  const results: ClipSweepResult["results"] = [];
  const failed: Record<string, string> = JSON.parse((await env.KILOWATTO_KV.get(FAILED_KEY)) ?? "{}");

  for (const item of attempted) {
    try {
      const r = await runClipPost(item.entityType, item.entityId);
      results.push({
        item,
        ok: !!r.ok,
        detail: r.ok ? (r.skipped ?? `${r.seconds}s · ${r.postIds?.length ?? 0} posts en cola`) : String(r.error),
      });
    } catch (err: any) {
      results.push({ item, ok: false, detail: String(err?.message ?? err) });
    }
    const last = results[results.length - 1];
    const key = `${item.entityType}:${item.entityId}`;
    if (last.ok) delete failed[key];
    else failed[key] = new Date().toISOString();
  }

  await env.KILOWATTO_KV.put(FAILED_KEY, JSON.stringify(failed));

  const broken = results.filter((r) => !r.ok);
  if (broken.length > 0) {
    await sendAlert(
      `Clips: ${broken.length} render${broken.length === 1 ? "" : "s"} falló`,
      broken.map((f) => `${f.item.entityType} ${f.item.entityId} — ${f.item.title}\n  ${f.detail}`).join("\n\n")
    );
  }

  await env.KILOWATTO_KV.put(
    LAST_RUN_KEY,
    JSON.stringify({ at: new Date().toISOString(), pending: pending.length, done: results.length })
  );

  return { ...base, results };
}

export async function lastClipSweep(): Promise<{ at: string; pending: number; done: number } | null> {
  try {
    const raw = await env.KILOWATTO_KV.get(LAST_RUN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

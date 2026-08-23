import { queryPageViews } from "./cf-analytics";

// Reads listening telemetry out of kilowatto_audio_events (written by
// src/pages/api/audio-event.ts).
//
// Column meanings are fixed by that writer and must not be reordered:
//   blob1 entityType  blob2 entityId  blob3 locale  blob4 event  blob5 country
//   blob6 device      blob7 pathname  blob8 sessionId
//   double1 position  double2 duration  double3 percent
//
// Every function returns null on failure so an admin page degrades to "no data" instead of
// erroring: Analytics Engine reads need a separate API token from the write binding, and that
// token expiring should not take a dashboard down.

export interface AudioTotals {
  plays: number;
  completions: number;
  listeners: number;
  completionRate: number;
}

export async function getAudioTotals(days = 30): Promise<AudioTotals | null> {
  try {
    const res = await queryPageViews(
      `SELECT
         SUM(IF(blob4 = 'play', 1, 0)) AS plays,
         SUM(IF(blob4 = 'ended', 1, 0)) AS completions,
         COUNT() AS events
       FROM kilowatto_audio_events
       WHERE timestamp > NOW() - INTERVAL '${days}' DAY`
    );
    const row: any = res.data?.[0];
    if (!row) return null;
    const plays = Number(row.plays ?? 0);
    const completions = Number(row.completions ?? 0);
    return {
      plays,
      completions,
      listeners: Number(row.events ?? 0),
      completionRate: plays > 0 ? Math.round((completions / plays) * 100) : 0,
    };
  } catch {
    return null;
  }
}

export interface AudioPiece {
  entityType: string;
  entityId: number;
  /** '' on rows written before the conversation existed; those are all narrations. */
  kind: string;
  plays: number;
  completions: number;
  completionRate: number;
}

export async function getAudioByPiece(days = 30, limit = 20): Promise<AudioPiece[] | null> {
  try {
    const res = await queryPageViews(
      `SELECT blob1 AS entityType, blob2 AS entityId, blob9 AS kind,
              SUM(IF(blob4 = 'play', 1, 0)) AS plays,
              SUM(IF(blob4 = 'ended', 1, 0)) AS completions
       FROM kilowatto_audio_events
       WHERE timestamp > NOW() - INTERVAL '${days}' DAY
       GROUP BY entityType, entityId, kind
       ORDER BY plays DESC
       LIMIT ${limit}`
    );
    return (res.data ?? []).map((r: any) => {
      const plays = Number(r.plays ?? 0);
      const completions = Number(r.completions ?? 0);
      return {
        entityType: String(r.entityType),
        entityId: Number(r.entityId),
        kind: String(r.kind ?? ""),
        plays,
        completions,
        completionRate: plays > 0 ? Math.round((completions / plays) * 100) : 0,
      };
    });
  } catch {
    return null;
  }
}

export interface DropOffBucket {
  decile: number; // 0 = 0-10% of the piece, 9 = 90-100%
  reached: number;
}

// Where listening stops. Built from the furthest position each event reports, bucketed into
// tenths of the piece -- the shape of this curve is the actual question ("¿lo terminan y dónde
// lo dejan?"), which a single average would hide.
export async function getDropOffCurve(days = 30, entityId?: number): Promise<DropOffBucket[] | null> {
  try {
    const filter = entityId ? `AND blob2 = '${String(entityId).replace(/'/g, "")}'` : "";
    const res = await queryPageViews(
      `SELECT toUInt32(floor(double3 / 10)) AS decile, COUNT() AS reached
       FROM kilowatto_audio_events
       WHERE timestamp > NOW() - INTERVAL '${days}' DAY
         AND double3 > 0 ${filter}
       GROUP BY decile
       ORDER BY decile ASC`
    );
    const map = new Map<number, number>(
      (res.data ?? []).map((r: any) => [Math.min(9, Number(r.decile)), Number(r.reached)])
    );
    const out: DropOffBucket[] = [];
    for (let d = 0; d < 10; d++) out.push({ decile: d, reached: map.get(d) ?? 0 });
    return out;
  } catch {
    return null;
  }
}

export interface AudioEventCount {
  event: string;
  count: number;
}

export async function getAudioEventBreakdown(days = 30): Promise<AudioEventCount[] | null> {
  try {
    const res = await queryPageViews(
      `SELECT blob4 AS event, COUNT() AS count
       FROM kilowatto_audio_events
       WHERE timestamp > NOW() - INTERVAL '${days}' DAY
       GROUP BY event
       ORDER BY count DESC`
    );
    return (res.data ?? []).map((r: any) => ({ event: String(r.event), count: Number(r.count) }));
  } catch {
    return null;
  }
}

// Total seconds actually listened.
//
// Naively summing double1 across events massively overcounts: one listener who reaches 7:00
// emits play(0) + progress(100) + progress(200) + progress(300) + ended(400), which sums to
// 1000 seconds for a 400-second listen. The real figure is the sum of each SESSION's furthest
// position, which is why blob8 exists.
//
// Sessions before blob8 was added carry an empty id; those are excluded rather than lumped
// together, because collapsing them into one "session" would undercount just as badly as the
// naive sum overcounts.
export async function getSecondsListened(days = 30): Promise<number | null> {
  try {
    const res = await queryPageViews(
      `SELECT SUM(furthest) AS total FROM (
         SELECT blob8 AS session, MAX(double1) AS furthest
         FROM kilowatto_audio_events
         WHERE timestamp > NOW() - INTERVAL '${days}' DAY AND blob8 != ''
         GROUP BY session
       )`
    );
    const total = Number((res.data?.[0] as any)?.total ?? 0);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

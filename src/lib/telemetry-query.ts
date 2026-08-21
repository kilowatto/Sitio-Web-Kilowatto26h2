import { queryPageViews } from "./cf-analytics";

// Tracking only started 2026-08-21 (when middleware.ts began writing to
// kilowatto_page_views), so anything published before that date will look sparse for a
// while -- callers should treat a low row count as "still accumulating," not "unpopular."
export const TRACKING_STARTED = "2026-08-21";

export interface DailyViews {
  day: string; // YYYY-MM-DD
  views: number;
}

export interface HourlyViews {
  hour: number; // 0-23 UTC
  views: number;
}

export interface PathTelemetry {
  daily: DailyViews[];
  hourly: HourlyViews[];
  totalTrackedEvents: number;
}

function escapeSqlString(s: string): string {
  return s.replace(/'/g, "''");
}

// Real per-path telemetry from our own first-party log (see src/middleware.ts). Returns
// null if the query fails (token missing/invalid, API error) so callers can fall back to
// an honest "no data" state instead of crashing the page.
export async function getPathTelemetry(pathname: string, days = 14): Promise<PathTelemetry | null> {
  try {
    const path = escapeSqlString(pathname);
    const [dailyRes, hourlyRes] = await Promise.all([
      queryPageViews(
        `SELECT toDate(timestamp) AS day, count() AS views
         FROM kilowatto_page_views
         WHERE blob1 = '${path}' AND timestamp > NOW() - INTERVAL '${days}' DAY
         GROUP BY day
         ORDER BY day ASC`
      ),
      queryPageViews(
        `SELECT double1 AS hour, count() AS views
         FROM kilowatto_page_views
         WHERE blob1 = '${path}'
         GROUP BY hour
         ORDER BY hour ASC`
      ),
    ]);

    const dailyMap = new Map<string, number>(
      (dailyRes.data ?? []).map((r: any) => [String(r.day), Number(r.views)])
    );
    const daily: DailyViews[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      daily.push({ day: d, views: dailyMap.get(d) ?? 0 });
    }

    const hourlyMap = new Map<number, number>(
      (hourlyRes.data ?? []).map((r: any) => [Number(r.hour), Number(r.views)])
    );
    const hourly: HourlyViews[] = [];
    for (let h = 0; h < 24; h++) hourly.push({ hour: h, views: hourlyMap.get(h) ?? 0 });

    const totalTrackedEvents = daily.reduce((s, d) => s + d.views, 0);
    return { daily, hourly, totalTrackedEvents };
  } catch {
    return null;
  }
}

export interface TopPage {
  pathname: string;
  views: number;
}

// "Página más visitada" -- real, and only possible now that middleware.ts logs every
// request. entityType='pagina' excludes /columnas/ and /a-fondo/ paths (those are ranked
// separately via their own D1 view_count, which is a cumulative all-time total rather than
// bounded to however many days we ask Analytics Engine for).
export async function getTopPages(days = 30, limit = 5): Promise<TopPage[] | null> {
  try {
    const res = await queryPageViews(
      `SELECT blob1 AS pathname, count() AS views
       FROM kilowatto_page_views
       WHERE blob4 = 'pagina' AND timestamp > NOW() - INTERVAL '${days}' DAY
       GROUP BY pathname
       ORDER BY views DESC
       LIMIT ${limit}`
    );
    return (res.data ?? []).map((r: any) => ({ pathname: String(r.pathname), views: Number(r.views) }));
  } catch {
    return null;
  }
}

// Site-wide daily total (all paths combined) for the Inicio trend chart -- real, but bounded
// by TRACKING_STARTED; days before that just come back as 0 since the log didn't exist yet.
export async function getSiteDailyTotals(days = 7): Promise<DailyViews[] | null> {
  try {
    const res = await queryPageViews(
      `SELECT toDate(timestamp) AS day, count() AS views
       FROM kilowatto_page_views
       WHERE timestamp > NOW() - INTERVAL '${days}' DAY
       GROUP BY day
       ORDER BY day ASC`
    );
    const map = new Map<string, number>((res.data ?? []).map((r: any) => [String(r.day), Number(r.views)]));
    const out: DailyViews[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      out.push({ day: d, views: map.get(d) ?? 0 });
    }
    return out;
  } catch {
    return null;
  }
}

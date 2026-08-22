import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { queryPageViews } from "../../../lib/cf-analytics";
import { getPathTelemetry, getSiteDailyTotals, getTopPages } from "../../../lib/telemetry-query";

export const prerender = false;

// Temporary: confirms the Analytics Engine SQL API token works end to end, that real
// page-view rows are landing in kilowatto_page_views, AND that telemetry-query.ts's actual
// query shapes (toDate(), GROUP BY day/hour, the per-path filter) parse and return sane
// data -- before trusting the real admin pages built on top of them.
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const which = url.searchParams.get("which") ?? "raw";
  try {
    let data: any;
    if (which === "path") {
      const path = url.searchParams.get("path") ?? "/a-fondo/vpns-marketing-vs-realidad";
      data = await getPathTelemetry(path, 14);
    } else if (which === "site") {
      data = await getSiteDailyTotals(7);
    } else if (which === "pages") {
      data = await getTopPages(30, 5);
    } else if (which === "audio") {
      data = await queryPageViews(
        `SELECT blob1 AS tipo, blob2 AS id, blob4 AS evento, count() AS n
         FROM kilowatto_audio_events
         WHERE timestamp > NOW() - INTERVAL '1' DAY
         GROUP BY tipo, id, evento
         ORDER BY n DESC`
      );
    } else {
      data = await queryPageViews(
        `SELECT blob1 AS pathname, blob2 AS country, blob6 AS device, blob7 AS browser, count() AS views
         FROM kilowatto_page_views
         WHERE timestamp > NOW() - INTERVAL '1' DAY
         GROUP BY pathname, country, device, browser
         ORDER BY views DESC
         LIMIT 20`
      );
    }
    return new Response(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

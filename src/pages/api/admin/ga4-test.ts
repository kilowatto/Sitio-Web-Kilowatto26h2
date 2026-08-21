import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  runReport,
  getChannelBreakdown,
  getEngagementSummary,
  getDailyTrend,
  getNewVsReturning,
  getHourlyPattern,
  getGa4CountryBreakdown,
  getGa4DeviceBreakdown,
} from "../../../lib/ga4";

export const prerender = false;

// Temporary: confirms the GA4 service-account JWT + OAuth2 + Data API chain actually works
// end to end against the real property, before building any dashboard UI on top of it.
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const which = url.searchParams.get("which");
    let data: any;
    if (which === "channel") {
      data = await getChannelBreakdown(30);
    } else if (which === "summary") {
      data = await getEngagementSummary(28);
    } else if (which === "trend") {
      data = await getDailyTrend(7);
    } else if (which === "newret") {
      data = await getNewVsReturning(28);
    } else if (which === "hourly") {
      data = await getHourlyPattern(28);
    } else if (which === "country") {
      data = await getGa4CountryBreakdown(28, 8);
    } else if (which === "device") {
      data = await getGa4DeviceBreakdown(28);
    } else if (which === "probe") {
      data = await runReport({
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }, { name: "hour" }, { name: "newVsReturning" }, { name: "deviceCategory" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "sessions" },
          { name: "engagementRate" },
          { name: "averageSessionDuration" },
          { name: "activeUsers" },
        ],
        limit: 5,
      });
    } else {
      data = await runReport({
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
      });
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

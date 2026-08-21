import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { queryPageViews } from "../../../lib/cf-analytics";

export const prerender = false;

// Temporary: confirms the Analytics Engine SQL API token works end to end and that real
// page-view rows are actually landing in kilowatto_page_views before building dashboard UI.
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const data = await queryPageViews(
      `SELECT blob1 AS pathname, blob2 AS country, blob6 AS device, blob7 AS browser, count() AS views
       FROM kilowatto_page_views
       WHERE timestamp > NOW() - INTERVAL '1' DAY
       GROUP BY pathname, country, device, browser
       ORDER BY views DESC
       LIMIT 20`
    );
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

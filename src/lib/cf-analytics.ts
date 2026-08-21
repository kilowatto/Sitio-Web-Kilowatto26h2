import { env } from "cloudflare:workers";

// Queries the page-view events middleware.ts writes into Analytics Engine
// (kilowatto_page_views, binding PAGE_ANALYTICS -- see src/middleware.ts). Writing to
// Analytics Engine is free via the binding; READING it back requires the separate
// Analytics Engine SQL API, authenticated with an account-scoped API token (a different
// credential than the wrangler/D1 session), which Esteban created himself (2026-08-21)
// with "Account Analytics: Read" and set as the CLOUDFLARE_ANALYTICS_TOKEN secret.
const ACCOUNT_ID = "99c9300f175af0e76483b949f6c6acd1";
const SQL_API_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/analytics_engine/sql`;

// Schema written in src/middleware.ts's logPageView():
//   blob1=pathname, blob2=country, blob3=language, blob4=entityType, blob5=referrerHost,
//   blob6=device, blob7=browser, double1=hourOfDayUTC, index1=pathname
export async function queryPageViews(sql: string): Promise<any> {
  const token = env.CLOUDFLARE_ANALYTICS_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_ANALYTICS_TOKEN not set");

  const res = await fetch(SQL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: sql,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Analytics Engine SQL query failed: ${res.status} ${body}`);
  }
  return res.json();
}

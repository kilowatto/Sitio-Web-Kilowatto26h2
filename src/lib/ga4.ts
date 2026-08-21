import { env } from "cloudflare:workers";

// Reads real GA4 data (property 546258249, kilowatto.com) via the Google Analytics Data
// API. Auth is a service-account JWT (RS256) exchanged for an OAuth2 access token --
// there's no Google client library that runs on Workers, so this signs the JWT by hand
// with WebCrypto. Esteban created the service account and granted it Viewer access on the
// GA4 property himself (2026-08-21); GA_SERVICE_ACCOUNT_EMAIL/GA_SERVICE_ACCOUNT_KEY are
// Worker secrets, never checked into the repo.
const GA4_PROPERTY_ID = "546258249";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlFromString(s: string): string {
  return base64url(new TextEncoder().encode(s));
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    // Secrets pasted as a single line often carry literal backslash-n sequences instead
    // of real newlines (from the JSON key file's \n escapes) -- strip both forms.
    .replace(/\\r\\n|\\n|\r|\n|\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) return cachedToken.value;

  const email = env.GA_SERVICE_ACCOUNT_EMAIL;
  const keyPem = env.GA_SERVICE_ACCOUNT_KEY;
  if (!email || !keyPem) throw new Error("GA_SERVICE_ACCOUNT_EMAIL/GA_SERVICE_ACCOUNT_KEY not set");

  const nowSec = Math.floor(now / 1000);
  const header = base64urlFromString(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64urlFromString(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      exp: nowSec + 3600,
      iat: nowSec,
    })
  );
  const signingInput = `${header}.${claims}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(keyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GA4 token exchange failed: ${res.status} ${body}`);
  }
  const data: any = await res.json();
  cachedToken = { value: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return cachedToken.value;
}

export interface ChannelViews {
  channel: string;
  sessions: number;
}

// "De dónde vienen" -- real GA4 traffic-source breakdown (Direct, Organic Search, Referral,
// Social, etc.) for the admin Contenido page. Returns null on any failure so the page can
// fall back to an honest "no data" state instead of crashing.
export async function getChannelBreakdown(days = 30): Promise<ChannelViews[] | null> {
  try {
    const data = await runReport({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    });
    const rows = data.rows ?? [];
    return rows.map((r: any) => ({
      channel: String(r.dimensionValues?.[0]?.value ?? "(sin datos)"),
      sessions: Number(r.metricValues?.[0]?.value ?? 0),
    }));
  } catch {
    return null;
  }
}

export interface DailyTrend {
  day: string; // YYYY-MM-DD
  views: number;
  sessions: number;
}

// Real daily trend from GA4 -- unlike our own first-party log (kilowatto_page_views, which
// only started recording 2026-08-21), GA4 has weeks of real history already, so this is what
// actually powers "tendencia" charts until our own log catches up.
export async function getDailyTrend(days = 28): Promise<DailyTrend[] | null> {
  try {
    const data = await runReport({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 400,
    });
    const rows = data.rows ?? [];
    return rows.map((r: any) => {
      const raw = String(r.dimensionValues?.[0]?.value ?? "");
      const day = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      return {
        day,
        views: Number(r.metricValues?.[0]?.value ?? 0),
        sessions: Number(r.metricValues?.[1]?.value ?? 0),
      };
    });
  } catch {
    return null;
  }
}

export interface EngagementSummary {
  activeUsers: number;
  sessions: number;
  engagementRate: number; // 0-1
  averageSessionDuration: number; // seconds
  screenPageViewsPerSession: number;
}

export async function getEngagementSummary(days = 28): Promise<EngagementSummary | null> {
  try {
    const data = await runReport({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "engagementRate" },
        { name: "averageSessionDuration" },
        { name: "screenPageViewsPerSession" },
      ],
    });
    const v = data.rows?.[0]?.metricValues;
    if (!v) return null;
    return {
      activeUsers: Number(v[0]?.value ?? 0),
      sessions: Number(v[1]?.value ?? 0),
      engagementRate: Number(v[2]?.value ?? 0),
      averageSessionDuration: Number(v[3]?.value ?? 0),
      screenPageViewsPerSession: Number(v[4]?.value ?? 0),
    };
  } catch {
    return null;
  }
}

export interface NewVsReturning {
  segment: "new" | "returning" | string;
  activeUsers: number;
}

export async function getNewVsReturning(days = 28): Promise<NewVsReturning[] | null> {
  try {
    const data = await runReport({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "newVsReturning" }],
      metrics: [{ name: "activeUsers" }],
    });
    const rows = data.rows ?? [];
    return rows
      .map((r: any) => ({
        segment: String(r.dimensionValues?.[0]?.value ?? "(sin datos)"),
        activeUsers: Number(r.metricValues?.[0]?.value ?? 0),
      }))
      .filter((r: NewVsReturning) => r.segment !== "(not set)");
  } catch {
    return null;
  }
}

export interface HourlyPattern {
  hour: number; // 0-23, local to the GA4 property's configured time zone
  views: number;
}

// Real time-of-day pattern from GA4, aggregated across the full date range -- has far more
// signal than our own log's single day of history.
export async function getHourlyPattern(days = 28): Promise<HourlyPattern[] | null> {
  try {
    const data = await runReport({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "hour" }],
      metrics: [{ name: "screenPageViews" }],
    });
    const map = new Map<number, number>(
      (data.rows ?? []).map((r: any) => [Number(r.dimensionValues?.[0]?.value ?? 0), Number(r.metricValues?.[0]?.value ?? 0)])
    );
    const out: HourlyPattern[] = [];
    for (let h = 0; h < 24; h++) out.push({ hour: h, views: map.get(h) ?? 0 });
    return out;
  } catch {
    return null;
  }
}

export interface Ga4CountryViews {
  country: string;
  activeUsers: number;
}

export async function getGa4CountryBreakdown(days = 28, limit = 10): Promise<Ga4CountryViews[] | null> {
  try {
    const data = await runReport({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit,
    });
    return (data.rows ?? []).map((r: any) => ({
      country: String(r.dimensionValues?.[0]?.value ?? "(sin datos)"),
      activeUsers: Number(r.metricValues?.[0]?.value ?? 0),
    }));
  } catch {
    return null;
  }
}

export interface Ga4DeviceViews {
  device: string;
  activeUsers: number;
}

export async function getGa4DeviceBreakdown(days = 28): Promise<Ga4DeviceViews[] | null> {
  try {
    const data = await runReport({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    });
    return (data.rows ?? []).map((r: any) => ({
      device: String(r.dimensionValues?.[0]?.value ?? "(sin datos)"),
      activeUsers: Number(r.metricValues?.[0]?.value ?? 0),
    }));
  } catch {
    return null;
  }
}

export async function runReport(body: Record<string, unknown>): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GA4 runReport failed: ${res.status} ${errBody}`);
  }
  return res.json();
}

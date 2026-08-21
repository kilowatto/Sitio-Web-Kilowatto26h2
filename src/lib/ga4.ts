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

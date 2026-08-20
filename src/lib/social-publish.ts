// Actual posting to X/LinkedIn — inert until Esteban configures credentials at
// /admin/settings (stored AES-GCM encrypted in D1, not Wrangler secrets — a Worker
// can't call `wrangler secret put` on itself, so a web-form-editable credential can't
// live there).
//
// X: posting needs OAuth 1.0a (X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN,
//    X_ACCESS_TOKEN_SECRET, all four from the Keys & Tokens page of Esteban's own
//    Developer Portal app — the app must have "Read and Write" permission BEFORE the
//    Access Token is generated, or it inherits read-only). X_BEARER_TOKEN (the plain
//    App-only bearer token) is read-only — confirmed live 2026-07-20 via
//    `x-access-level: read` on a real API response — so it's kept only for the metrics
//    GET call in publish.ts, never for posting. Posting is pay-per-use, ~$0.015/post.
// LinkedIn: needs LINKEDIN_ACCESS_TOKEN (w_member_social scope via "Share on LinkedIn"
//    product) + LINKEDIN_PERSON_URN (the numeric member URN, from /v2/userinfo once
//    authorized). Token expires every 60 days — needs a refresh-token flow before this
//    can run unattended for long.
import { decryptSetting } from "./crypto";
import { buildOAuth1Header } from "./oauth1";

interface PublishResult {
  ok: boolean;
  externalId?: string;
  externalUrl?: string;
  error?: string;
}

export async function getSetting(env: any, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT encrypted_value FROM brand_api_settings WHERE key = ?").bind(key).first<any>();
  if (!row) return null;
  return decryptSetting(env, row.encrypted_value);
}

export async function postToX(env: any, content: string): Promise<PublishResult> {
  const [apiKey, apiKeySecret, accessToken, accessTokenSecret] = await Promise.all([
    getSetting(env, "X_API_KEY"),
    getSetting(env, "X_API_KEY_SECRET"),
    getSetting(env, "X_ACCESS_TOKEN"),
    getSetting(env, "X_ACCESS_TOKEN_SECRET"),
  ]);
  if (!apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) {
    return {
      ok: false,
      error:
        "Faltan credenciales OAuth 1.0a de X (X_API_KEY/X_API_KEY_SECRET/X_ACCESS_TOKEN/X_ACCESS_TOKEN_SECRET) — agrégalas en /admin/settings. El X_BEARER_TOKEN simple es de solo lectura, no puede publicar.",
    };
  }

  const url = "https://api.x.com/2/tweets";
  const authorization = await buildOAuth1Header("POST", url, { apiKey, apiKeySecret, accessToken, accessTokenSecret });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body: JSON.stringify({ text: content }),
  });
  if (!res.ok) {
    return { ok: false, error: `X API ${res.status}: ${await res.text()}` };
  }
  const data: any = await res.json();
  const id = data?.data?.id;
  return { ok: true, externalId: id, externalUrl: id ? `https://x.com/Kilowatto/status/${id}` : undefined };
}

export async function postToLinkedIn(env: any, content: string): Promise<PublishResult> {
  const [accessToken, personUrn] = await Promise.all([
    getSetting(env, "LINKEDIN_ACCESS_TOKEN"),
    getSetting(env, "LINKEDIN_PERSON_URN"),
  ]);
  if (!accessToken || !personUrn) {
    return { ok: false, error: "LINKEDIN_ACCESS_TOKEN/LINKEDIN_PERSON_URN no configurados — agrégalos en /admin/settings" };
  }
  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "LinkedIn-Version": "202601",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: personUrn,
      commentary: content,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
    }),
  });
  if (!res.ok) {
    return { ok: false, error: `LinkedIn API ${res.status}: ${await res.text()}` };
  }
  const id = res.headers.get("x-restli-id") ?? undefined;
  return { ok: true, externalId: id, externalUrl: id ? `https://www.linkedin.com/feed/update/${id}` : undefined };
}

export async function publishPost(env: any, platform: "x" | "linkedin", content: string): Promise<PublishResult> {
  return platform === "x" ? postToX(env, content) : postToLinkedIn(env, content);
}

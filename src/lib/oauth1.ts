// OAuth 1.0a request signing (HMAC-SHA1) for posting to X on Esteban's own account.
// Chosen over OAuth2 user-context tokens because Access Token + Secret from the Keys &
// Tokens page never expire (no refresh-token flow to maintain) — right tradeoff for a
// single-account bot, confirmed 2026-07-20 after the plain Bearer Token turned out to be
// read-only (x-access-level: read) and unable to post.

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function randomNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha1(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

interface OAuth1Credentials {
  apiKey: string;
  apiKeySecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export async function buildOAuth1Header(
  method: string,
  url: string,
  creds: OAuth1Credentials
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: randomNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  // The signature base string's URL component must be the bare base URL with NO query
  // string — query params get signed as part of the parameter string instead, merged and
  // sorted together with the oauth_* params. Every call so far happened to hit endpoints
  // with no query params, which masked this: passing the full URL (query included) here
  // would silently produce a wrong signature the moment a caller adds one (confirmed while
  // wiring up a `?user.fields=...` call for follower-count snapshots).
  const parsedUrl = new URL(url);
  const baseUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
  const allParams: Record<string, string> = { ...oauthParams };
  for (const [k, v] of parsedUrl.searchParams) allParams[k] = v;

  const paramString = Object.entries(allParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  const baseString = [method.toUpperCase(), percentEncode(baseUrl), percentEncode(paramString)].join("&");
  const signingKey = `${percentEncode(creds.apiKeySecret)}&${percentEncode(creds.accessTokenSecret)}`;
  const signature = await hmacSha1(signingKey, baseString);

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const header =
    "OAuth " +
    Object.entries(headerParams)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
      .join(", ");

  return header;
}

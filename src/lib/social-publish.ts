// Actual posting to X/LinkedIn — inert until Esteban provisions credentials, same
// pattern as GTM_ID/Turnstile elsewhere in this project: scaffolded, not skipped.
//
// X: needs X_BEARER_TOKEN (OAuth2 user-context token with write scope, from a Developer
//    Portal app on Esteban's own account — posting is pay-per-use now, ~$0.015/post).
// LinkedIn: needs LINKEDIN_ACCESS_TOKEN (w_member_social scope via "Share on LinkedIn"
//    product) + LINKEDIN_PERSON_URN (the numeric member URN, from /v2/userinfo once
//    authorized). Token expires every 60 days — needs a refresh-token flow before this
//    can run unattended for long.

interface PublishResult {
  ok: boolean;
  externalId?: string;
  externalUrl?: string;
  error?: string;
}

export async function postToX(env: any, content: string): Promise<PublishResult> {
  if (!env.X_BEARER_TOKEN) {
    return { ok: false, error: "X_BEARER_TOKEN no configurado — falta crear la app en developer.x.com" };
  }
  const res = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.X_BEARER_TOKEN}`,
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
  if (!env.LINKEDIN_ACCESS_TOKEN || !env.LINKEDIN_PERSON_URN) {
    return { ok: false, error: "LINKEDIN_ACCESS_TOKEN/LINKEDIN_PERSON_URN no configurados — falta registrar la app en LinkedIn Developer Portal" };
  }
  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,
      "content-type": "application/json",
      "LinkedIn-Version": "202601",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: env.LINKEDIN_PERSON_URN,
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

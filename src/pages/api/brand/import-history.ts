import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getSetting } from "../../../lib/social-publish";
import { buildOAuth1Header } from "../../../lib/oauth1";

export const prerender = false;

// One-off (or occasionally re-run) backfill: pulls Esteban's REAL X posting history
// (tweets made outside this system too — from his phone, the web, wherever) with their
// real metrics, so /admin/reports reflects his actual account history, not just what went
// through Larry's pipeline. LinkedIn has no equivalent for a personal profile under the
// basic w_member_social/openid scopes — X only, honestly documented in the report's footer.
export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const [apiKey, apiKeySecret, accessToken, accessTokenSecret] = await Promise.all([
    getSetting(env, "X_API_KEY"),
    getSetting(env, "X_API_KEY_SECRET"),
    getSetting(env, "X_ACCESS_TOKEN"),
    getSetting(env, "X_ACCESS_TOKEN_SECRET"),
  ]);
  if (!apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) {
    return new Response(JSON.stringify({ error: "faltan credenciales OAuth 1.0a de X" }), { status: 400 });
  }
  const creds = { apiKey, apiKeySecret, accessToken, accessTokenSecret };

  async function signedGet(fetchUrl: string) {
    const authorization = await buildOAuth1Header("GET", fetchUrl, creds);
    const res = await fetch(fetchUrl, { headers: { authorization } });
    if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  const meUrl = "https://api.x.com/2/users/me";
  const me: any = await signedGet(meUrl);
  const userId = me?.data?.id;
  if (!userId) return new Response(JSON.stringify({ error: "no se pudo obtener el user id" }), { status: 502 });

  let imported = 0;
  let skipped = 0;
  let paginationToken: string | undefined;

  // Two pages (~200 tweets) is a reasonable first backfill — re-running the import later
  // naturally picks up anything newer via the external_post_id duplicate check below.
  for (let page = 0; page < 2; page++) {
    const params = new URLSearchParams({
      max_results: "100",
      "tweet.fields": "public_metrics,created_at",
      exclude: "retweets,replies",
    });
    if (paginationToken) params.set("pagination_token", paginationToken);

    const tweetsUrl = `https://api.x.com/2/users/${userId}/tweets?${params.toString()}`;
    const data: any = await signedGet(tweetsUrl);
    const tweets = data?.data ?? [];

    for (const t of tweets) {
      const existing = await env.DB.prepare("SELECT id FROM brand_posts WHERE external_post_id = ? AND platform = 'x'")
        .bind(t.id)
        .first<any>();
      if (existing) {
        skipped++;
        continue;
      }

      const postedAt = t.created_at ? t.created_at.replace("T", " ").replace("Z", "") : null;
      // kind is CHECK-constrained to ('news_reshare', 'idea') — reusing 'idea' rather than
      // widening that constraint (would mean recreating the table given SQLite's lack of
      // ALTER-CHECK support, with brand_post_metrics/short_links/brand_comment_suggestions
      // all holding foreign keys into it — real surgery for a label that's cosmetic here).
      // idea_prompt stays NULL, which is enough to tell an import apart from a real Larry
      // draft if it ever matters.
      const res = await env.DB.prepare(
        `INSERT INTO brand_posts (platform, kind, language, content, status, posted_at, external_post_id, external_url)
         VALUES ('x', 'idea', 'es', ?, 'posted', ?, ?, ?)`
      )
        .bind(t.text ?? "", postedAt, t.id, `https://x.com/Kilowatto/status/${t.id}`)
        .run();

      const m = t.public_metrics ?? {};
      await env.DB.prepare(
        `INSERT INTO brand_post_metrics (brand_post_id, impressions, likes, comments, shares) VALUES (?, ?, ?, ?, ?)`
      )
        .bind(res.meta.last_row_id, m.impression_count ?? 0, m.like_count ?? 0, m.reply_count ?? 0, m.retweet_count ?? 0)
        .run();

      imported++;
    }

    paginationToken = data?.meta?.next_token;
    if (!paginationToken) break;
  }

  return new Response(JSON.stringify({ ok: true, imported, skipped }), { headers: { "content-type": "application/json" } });
};

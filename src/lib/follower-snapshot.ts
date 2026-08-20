import { getSetting } from "./social-publish";
import { buildOAuth1Header } from "./oauth1";

// Once-a-day X follower count snapshot for the reports dashboard's growth chart. Called
// from tick.ts (which runs every ~30min) but skips itself unless the last snapshot for this
// platform is over 20 hours old, so it doesn't hammer X's rate limit or store noise.
export async function maybeSnapshotFollowers(env: any) {
  const last = await env.DB.prepare(
    `SELECT fetched_at FROM follower_snapshots WHERE platform = 'x' ORDER BY fetched_at DESC LIMIT 1`
  ).first<any>();
  if (last) {
    const hoursSince = (Date.now() - new Date(last.fetched_at + "Z").getTime()) / 3_600_000;
    if (hoursSince < 20) return;
  }

  const [apiKey, apiKeySecret, accessToken, accessTokenSecret] = await Promise.all([
    getSetting(env, "X_API_KEY"),
    getSetting(env, "X_API_KEY_SECRET"),
    getSetting(env, "X_ACCESS_TOKEN"),
    getSetting(env, "X_ACCESS_TOKEN_SECRET"),
  ]);
  if (!apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) return;

  const url = "https://api.x.com/2/users/me?user.fields=public_metrics";
  try {
    const authorization = await buildOAuth1Header("GET", url, { apiKey, apiKeySecret, accessToken, accessTokenSecret });
    const res = await fetch(url, { headers: { authorization } });
    if (!res.ok) return;
    const data: any = await res.json();
    const followers = data?.data?.public_metrics?.followers_count;
    if (typeof followers !== "number") return;
    await env.DB.prepare("INSERT INTO follower_snapshots (platform, followers) VALUES ('x', ?)").bind(followers).run();
  } catch (err) {
    console.error("maybeSnapshotFollowers failed:", err);
  }
}

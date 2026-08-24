import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { relatePendingPosts, findRelatedPiece } from "../../../lib/post-relate";

export const prerender = false;

function authed(url: URL): boolean {
  const t = url.searchParams.get("token");
  return t === env.ADMIN_TOKEN || t === env.SCRATCH_TOKEN;
}

// Dry run: what WOULD be linked, without touching anything.
export const GET: APIRoute = async ({ url }) => {
  if (!authed(url)) return new Response("unauthorized", { status: 401 });

  // ?text=... probes the matcher directly. The threshold is the whole design of this feature and
  // it has to be calibrated against real text, not guessed.
  const probe = url.searchParams.get("text");
  if (probe) return Response.json({ probe: probe.slice(0, 80), match: await findRelatedPiece(probe) });

  const limit = Number(url.searchParams.get("limit") ?? 15);
  const rows = await env.DB.prepare(
    `SELECT id, kind, substr(content, 1, 200) AS content FROM brand_posts
      WHERE status IN ('pending_approval','approved') AND kind IN ('idea','news_reaction','news_reshare')
        AND (source_url IS NULL OR source_url NOT LIKE '%kilowatto.com%')
      ORDER BY id DESC LIMIT ?`
  )
    .bind(limit)
    .all<any>();
  const out = [];
  for (const r of rows.results ?? []) {
    const related = await findRelatedPiece(r.content);
    const best = related ?? (await findRelatedPiece(r.content, 0));
    out.push({
      id: r.id,
      kind: r.kind,
      preview: r.content.slice(0, 90),
      match: related?.title ?? null,
      score: related?.score ?? null,
      bestCandidate: best?.title ?? null,
      bestScore: best?.score ?? null,
    });
  }
  return Response.json({ examined: out.length, wouldLink: out.filter((o) => o.match).length, out });
};

export const POST: APIRoute = async ({ url }) => {
  if (!authed(url)) return new Response("unauthorized", { status: 401 });
  return Response.json(
    await relatePendingPosts(Number(url.searchParams.get("limit") ?? 40), Number(url.searchParams.get("after") ?? 0))
  );
};

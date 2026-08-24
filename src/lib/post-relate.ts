import { env } from "cloudflare:workers";
import { createShortLink } from "./short-links";

// Attaches a link to Esteban's own work to posts that were not about it.
//
// Of 767 generated posts, 707 link nowhere near kilowatto.com: every `idea`, every
// `news_reaction`, every `news_reshare`. The system publishes constantly and almost nothing it
// publishes sends anyone to read. This closes that.
//
// ONLY when the match is strong -- Esteban's call, and the right one. A forced link reads as
// spam and teaches readers to ignore the ones that are not forced. Most news reactions will
// simply have no related piece, and they go out without a link, which is fine.

const EMBEDDING_MODEL = "@cf/baai/bge-m3"; // must match reindex.ts and chat.ts

// Cosine similarity from Vectorize. Calibrated by hand against real posts (2026-08-23): the
// chatbot index holds one vector per SECTION, so a post about the same subject as a column
// scores around 0.62-0.70, while a news reaction that merely shares vocabulary sits near 0.45.
// 0.60 is above the noise and below the genuine matches. Deliberately conservative: a missed
// link costs one click, a wrong link costs credibility.
//
// Verified 2026-08-23 against six probes. Three drawn from real pieces scored 0.666, 0.760 and
// 0.663 and matched the right piece; three unrelated ones -- a model launch, a mole recipe, a
// weather report -- matched nothing at all. No false positives.
const MIN_SCORE = 0.6;

export interface RelatedPiece {
  entityType: "column" | "investigacion" | "company" | "investment";
  entityId: number;
  slug: string;
  title: string;
  score: number;
  url: string;
}

// Companies and investments are link targets too, and on this corpus they matter more than the
// writing does. 153 of the linkless posts are news reshares about Finsus -- one of Esteban's
// investments -- which genuinely relate to none of his 23 written pieces. Sending those to the
// company's own entry is a real hook to the site; sending them to a column about VPNs, which is
// what a lower threshold would have done at 0.543, is spam.
const TARGETS: Record<string, { table: string; url: (slug: string) => string }> = {
  column: { table: "columns", url: (s) => `https://kilowatto.com/columnas/${s}` },
  investigacion: { table: "investigaciones", url: (s) => `https://kilowatto.com/a-fondo/${s}` },
  company: { table: "companies", url: (s) => `https://kilowatto.com/empresas#${s}` },
  investment: { table: "investments", url: (s) => `https://kilowatto.com/inversiones#${s}` },
};

// `minScore` is overridable so the dry run can report the BEST candidate regardless of the
// threshold. Reporting only pass/fail hides whether the threshold is set sensibly or whether
// nothing is close at all -- and those need different fixes.
// Companies and investments are named things, and a post about one almost always says its name.
// That is a far better signal than cosine distance: the embedding put every Finsus reshare next
// to the Finsus entry correctly but scored them 0.52-0.59, under a threshold that exists to keep
// vague matches out. Lowering it to catch them would also have let through the 0.543 match
// between a Finsus post and a column about VPNs.
//
// So named entities are matched by name and articles by meaning. Exact where exact is possible.
async function findNamedEntity(text: string): Promise<RelatedPiece | null> {
  const haystack = ` ${text.toLowerCase()} `;
  for (const [type, table] of [["company", "companies"], ["investment", "investments"]] as const) {
    const rows = await env.DB.prepare(`SELECT id, slug, name FROM ${table}`).all<{ id: number; slug: string; name: string }>();
    for (const r of rows.results ?? []) {
      // The stored name is often "Finsus" but sometimes "OnCloud (Súbete a la Nube S.A. de C.V.)";
      // the part before the parenthesis is what a post would actually write.
      const short = r.name.split("(")[0].trim();
      if (short.length < 4) continue; // "ULA" and friends collide with ordinary words
      if (!haystack.includes(` ${short.toLowerCase()}`)) continue;
      return {
        entityType: type,
        entityId: r.id,
        slug: r.slug,
        title: short,
        score: 1,
        url: TARGETS[type].url(r.slug),
      };
    }
  }
  return null;
}

export async function findRelatedPiece(text: string, minScore = MIN_SCORE): Promise<RelatedPiece | null> {
  const named = await findNamedEntity(text);
  if (named) return named;

  try {
    const embedding: any = await env.AI.run(EMBEDDING_MODEL, { text: [text.slice(0, 2000)] });
    const vector = embedding?.data?.[0];
    if (!vector) return null;

    // topK is generous because the index holds everything Larry knows -- press, books, food,
    // the ostriches -- and only a handful of those matches will be a column or investigación.
    const res = await env.VECTORIZE.query(vector, { topK: 12, returnMetadata: true });
    for (const m of res.matches ?? []) {
      const type = String(m.metadata?.entity_type ?? "");
      const target = TARGETS[type];
      if (!target) continue;
      if ((m.score ?? 0) < minScore) continue;

      // Only articles have a status to check; companies and investments are always live.
      const isArticle = type === "column" || type === "investigacion";
      const row = await env.DB.prepare(
        `SELECT id, slug, ${type === "company" || type === "investment" ? "name AS title" : "title"} FROM ${target.table}
          WHERE id = ?${isArticle ? " AND status = 'published'" : ""}`
      )
        .bind(Number(m.metadata?.entity_id))
        .first<{ id: number; slug: string; title: string }>();
      if (!row?.slug) continue;

      return {
        entityType: type as RelatedPiece["entityType"],
        entityId: row.id,
        slug: row.slug,
        title: row.title,
        score: Number(m.score),
        url: target.url(row.slug),
      };
    }
    return null;
  } catch {
    // Never let this block a post from existing.
    return null;
  }
}

export interface RelateResult {
  examined: number;
  linked: number;
  skippedNoMatch: number;
  /** Highest id seen, so the caller can continue from here. */
  lastId: number;
  details: { id: number; title: string; score: number }[];
}

// Walks posts that carry no link to the site and adds one where the match is strong.
//
// Covers 'approved' as well as 'pending_approval'. Both are queued and neither has gone out;
// 182 approved posts were sitting in the queue with no link at all, which is most of the problem
// and would have published over the coming months regardless of anything fixed today. Posts that
// have already POSTED are never touched -- rewriting published history is dishonest, and the
// link would reach nobody anyway.
//
// The link is APPENDED, never woven in. Esteban approved a message; this adds a pointer to it
// rather than changing it.
export async function relatePendingPosts(limit = 40, afterId = 0): Promise<RelateResult> {
  // Paginated ascending by id, not "the newest 40".
  //
  // The first version took the newest 40 unlinked posts every call, so once those 40 had no
  // match it re-examined the same 40 forever and never reached the rest of the queue -- 130
  // posts deeper in were never looked at. Ascending with a cursor walks the whole queue.
  const rows = await env.DB.prepare(
    `SELECT id, content, kind FROM brand_posts
      WHERE status IN ('pending_approval', 'approved')
        AND kind IN ('idea', 'news_reaction', 'news_reshare')
        AND (source_url IS NULL OR source_url NOT LIKE '%kilowatto.com%')
        AND id > ?
      ORDER BY id ASC LIMIT ?`
  )
    .bind(afterId, limit)
    .all<{ id: number; content: string; kind: string }>();

  const result: RelateResult = { examined: 0, linked: 0, skippedNoMatch: 0, lastId: afterId, details: [] };

  for (const post of rows.results ?? []) {
    result.examined++;
    result.lastId = post.id;
    const related = await findRelatedPiece(post.content);
    if (!related) {
      result.skippedNoMatch++;
      continue;
    }

    const targetUrl = related.url;
    let shortUrl = targetUrl;
    try {
      shortUrl = await createShortLink(targetUrl, post.id);
    } catch {
      /* the full URL still works */
    }

    // Appended, never woven into the text. The post was written without knowing this link
    // existed, and having a model rewrite it around the link would risk the number guard and
    // the voice for no gain.
    // Different wording per target: "escribí sobre esto" is true of a column and false of a
    // company page, and a link whose label lies is worse than no link.
    const label =
      related.entityType === "column" || related.entityType === "investigacion"
        ? "Escribí sobre esto"
        : "Más sobre esto";
    const content = `${post.content}\n\n${label} → ${shortUrl}`;

    // Only articles get the FK; companies and investments have no column in brand_posts and do
    // not need one -- the short link already carries the attribution.
    const fk =
      related.entityType === "column" ? "column_id" : related.entityType === "investigacion" ? "investigacion_id" : null;
    await env.DB.prepare(
      fk
        ? `UPDATE brand_posts SET content = ?, source_url = ?, ${fk} = ? WHERE id = ?`
        : `UPDATE brand_posts SET content = ?, source_url = ? WHERE id = ?`
    )
      .bind(...(fk ? [content, shortUrl, related.entityId, post.id] : [content, shortUrl, post.id]))
      .run();

    result.linked++;
    result.details.push({ id: post.id, title: related.title, score: Number(related.score.toFixed(3)) });
  }

  return result;
}

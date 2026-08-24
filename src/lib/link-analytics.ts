import { env } from "cloudflare:workers";

// Reads the click log behind kilowatto.com/r/.
//
// The table already captures everything Esteban asked for -- IP, ASN, organisation, city,
// region, timezone, colo, agent, mobile flag, referrer, language, screen and viewport -- because
// /r/[slug] was built that way on 2026-08-21. What was missing is that his own columns,
// investigaciones and audio never used the shortener, so there was nothing to read.
//
// Platform is not stored on the click: it is derived by joining short_links.brand_post_id back
// to brand_posts.platform. That is deliberate -- the same short link can be reused, and the post
// is the thing that has a platform, not the click.

export interface ClicksByPlatform {
  platform: string;
  kind: string;
  clicks: number;
  posts: number;
}

export async function getClicksByPlatform(days = 30): Promise<ClicksByPlatform[]> {
  const rows = await env.DB.prepare(
    `SELECT bp.platform, bp.kind, COUNT(lc.id) AS clicks, COUNT(DISTINCT bp.id) AS posts
       FROM link_clicks lc
       JOIN short_links sl ON sl.id = lc.short_link_id
       JOIN brand_posts bp ON bp.id = sl.brand_post_id
      WHERE lc.clicked_at > datetime('now', ?)
      GROUP BY bp.platform, bp.kind
      ORDER BY clicks DESC`
  )
    .bind(`-${days} days`)
    .all<ClicksByPlatform>();
  return rows.results ?? [];
}

export interface ClicksByPiece {
  title: string;
  section: string;
  slug: string;
  kind: string;
  clicks: number;
}

// Which piece a click sent someone to, regardless of which post carried the link.
export async function getClicksByPiece(days = 30, limit = 25): Promise<ClicksByPiece[]> {
  const rows = await env.DB.prepare(
    `SELECT COALESCE(c.title, i.title) AS title,
            CASE WHEN bp.column_id IS NOT NULL THEN 'columnas' ELSE 'a-fondo' END AS section,
            COALESCE(c.slug, i.slug) AS slug,
            bp.kind,
            COUNT(lc.id) AS clicks
       FROM link_clicks lc
       JOIN short_links sl ON sl.id = lc.short_link_id
       JOIN brand_posts bp ON bp.id = sl.brand_post_id
       LEFT JOIN columns c ON c.id = bp.column_id
       LEFT JOIN investigaciones i ON i.id = bp.investigacion_id
      WHERE lc.clicked_at > datetime('now', ?)
        AND (bp.column_id IS NOT NULL OR bp.investigacion_id IS NOT NULL)
      GROUP BY title, section, slug, bp.kind
      ORDER BY clicks DESC
      LIMIT ?`
  )
    .bind(`-${days} days`, limit)
    .all<ClicksByPiece>();
  return rows.results ?? [];
}

export interface ClickContext {
  label: string;
  value: string;
  clicks: number;
}

// Country, network and device breakdowns, from what /r/ already stores.
export async function getClickContext(days = 30): Promise<ClickContext[]> {
  const out: ClickContext[] = [];
  const queries: [string, string][] = [
    ["país", "country"],
    ["red", "as_organization"],
    ["ciudad", "city"],
  ];
  for (const [label, column] of queries) {
    const rows = await env.DB.prepare(
      `SELECT ${column} AS value, COUNT(*) AS clicks
         FROM link_clicks
        WHERE clicked_at > datetime('now', ?) AND ${column} IS NOT NULL AND ${column} != ''
        GROUP BY value ORDER BY clicks DESC LIMIT 6`
    )
      .bind(`-${days} days`)
      .all<{ value: string; clicks: number }>();
    for (const r of rows.results ?? []) out.push({ label, value: String(r.value), clicks: Number(r.clicks) });
  }
  return out;
}

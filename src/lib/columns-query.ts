export const COLUMNS_PAGE_SIZE = 10;

export interface ColumnRow {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  body_html: string;
  published_at: string;
  created_at: string;
  cover_r2_key: string | null;
  infographic_r2_key: string | null;
  illustration_r2_key: string | null;
  og_r2_key: string | null;
  status: string;
  view_count: number;
  display_seed: number | null;
}

// Public-facing "lecturas" number: a random 4-digit seed (fixed per column at creation) plus
// the real view count on top — starts non-zero like an established column, grows for real
// after that. The seed is cosmetic; view_count is tracked for real in incrementColumnView().
export function displayViewCount(column: Pick<ColumnRow, "view_count" | "display_seed">): number {
  return (column.display_seed ?? 1000) + column.view_count;
}

export async function incrementColumnView(env: any, id: number): Promise<void> {
  await env.DB.prepare("UPDATE columns SET view_count = view_count + 1 WHERE id = ?").bind(id).run();
}

export async function getColumnsPage(env: any, page: number): Promise<{ rows: ColumnRow[]; totalPages: number }> {
  const [countRes, res] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM columns WHERE status = 'published'").first<any>(),
    env.DB.prepare("SELECT * FROM columns WHERE status = 'published' ORDER BY published_at DESC LIMIT ? OFFSET ?")
      .bind(COLUMNS_PAGE_SIZE, (page - 1) * COLUMNS_PAGE_SIZE)
      .all(),
  ]);
  const totalPages = Math.max(1, Math.ceil((countRes?.n ?? 0) / COLUMNS_PAGE_SIZE));
  return { rows: res?.results ?? [], totalPages };
}

export async function getColumnBySlug(env: any, slug: string): Promise<ColumnRow | null> {
  const row = await env.DB.prepare("SELECT * FROM columns WHERE slug = ? AND status = 'published'").bind(slug).first<ColumnRow>();
  return row ?? null;
}

// Plain-text excerpt for listing cards / meta descriptions — derived at read time from
// body_html rather than stored separately, so there's only one place that can drift.
export function excerptFrom(bodyHtml: string, maxLen = 200): string {
  const text = bodyHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
}

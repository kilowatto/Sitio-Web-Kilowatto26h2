export const INVESTIGACIONES_PAGE_SIZE = 10;

export interface InvestigacionRow {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  hook: string | null;
  summary: string;
  body_html: string;
  methodology_html: string | null;
  read_minutes: number | null;
  status: string;
  cover_r2_key: string | null;
  share_r2_key: string | null;
  og_r2_key: string | null;
  published_at: string;
  created_at: string;
  display_seed: number;
  view_count: number;
}

export interface InvestigacionSourceRow {
  id: number;
  investigacion_id: number;
  position: number;
  label: string;
  url: string;
  confidence: "green" | "yellow" | "red";
  short_link_id: number | null;
}

export interface InvestigacionChartRow {
  id: number;
  investigacion_id: number;
  chart_key: string;
  chart_type: "bar" | "timeline" | "radar" | "cards" | "table";
  title: string;
  description: string | null;
  data_json: string;
  source_note: string | null;
  position: number;
}

// Same "seeded + real" counter as columns (see columns-query.ts) so this new section
// doesn't visibly start at zero.
export function displayViewCount(row: Pick<InvestigacionRow, "view_count" | "display_seed">): number {
  return (row.display_seed ?? 1000) + row.view_count;
}

export async function incrementInvestigacionView(env: any, id: number): Promise<void> {
  await env.DB.prepare("UPDATE investigaciones SET view_count = view_count + 1 WHERE id = ?").bind(id).run();
}

export async function getInvestigacionesPage(
  env: any,
  page: number
): Promise<{ rows: InvestigacionRow[]; totalPages: number }> {
  const [countRes, res] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM investigaciones WHERE status = 'published'").first<any>(),
    env.DB.prepare(
      "SELECT * FROM investigaciones WHERE status = 'published' ORDER BY published_at DESC LIMIT ? OFFSET ?"
    )
      .bind(INVESTIGACIONES_PAGE_SIZE, (page - 1) * INVESTIGACIONES_PAGE_SIZE)
      .all(),
  ]);
  const totalPages = Math.max(1, Math.ceil((countRes?.n ?? 0) / INVESTIGACIONES_PAGE_SIZE));
  return { rows: res?.results ?? [], totalPages };
}

export async function getInvestigacionBySlug(env: any, slug: string): Promise<InvestigacionRow | null> {
  const row = await env.DB.prepare("SELECT * FROM investigaciones WHERE slug = ? AND status = 'published'")
    .bind(slug)
    .first<InvestigacionRow>();
  return row ?? null;
}

export async function getInvestigacionSources(env: any, investigacionId: number): Promise<InvestigacionSourceRow[]> {
  const res = await env.DB.prepare(
    "SELECT * FROM investigacion_sources WHERE investigacion_id = ? ORDER BY position"
  )
    .bind(investigacionId)
    .all<InvestigacionSourceRow>();
  return res?.results ?? [];
}

export async function getInvestigacionCharts(env: any, investigacionId: number): Promise<InvestigacionChartRow[]> {
  const res = await env.DB.prepare(
    "SELECT * FROM investigacion_charts WHERE investigacion_id = ? ORDER BY position"
  )
    .bind(investigacionId)
    .all<InvestigacionChartRow>();
  return res?.results ?? [];
}

// Same excerpt-at-read-time approach as columns' excerptFrom().
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

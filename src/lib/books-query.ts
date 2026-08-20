// Shared query/filter logic between /biblioteca and /biblioteca/[page] — mirrors the
// press pagination pattern (real server-rendered pages, crawlable links, JS progressive
// enhancement into infinite scroll), extended with genre/author/text filters.

export const BOOKS_PAGE_SIZE = 24;

export interface BookFilters {
  genero: string | null;
  autor: string | null;
  q: string | null;
}

export function parseFilters(url: URL): BookFilters {
  return {
    genero: url.searchParams.get("genero"),
    autor: url.searchParams.get("autor"),
    q: url.searchParams.get("q"),
  };
}

// Query string (without leading "?") preserving only the recognized filter params —
// used to carry filters across pagination links.
export function filtersToQueryString(filters: BookFilters): string {
  const params = new URLSearchParams();
  if (filters.genero) params.set("genero", filters.genero);
  if (filters.autor) params.set("autor", filters.autor);
  if (filters.q) params.set("q", filters.q);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function whereClause(filters: BookFilters) {
  // Only "owned" books show up in the main paginated collection — wishlist/missing books
  // (status='quiero') live in their own section, not mixed into the regular grid.
  const clauses: string[] = ["status = 'tengo'"];
  const params: unknown[] = [];
  if (filters.genero) {
    clauses.push("genre = ?");
    params.push(filters.genero);
  }
  if (filters.autor) {
    clauses.push("author = ?");
    params.push(filters.autor);
  }
  if (filters.q) {
    clauses.push("(title LIKE ? OR author LIKE ? OR summary LIKE ?)");
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  return { sql: `WHERE ${clauses.join(" AND ")}`, params };
}

export async function getBooksPage(env: any, filters: BookFilters, pageNum: number, pageSize = BOOKS_PAGE_SIZE) {
  const { sql: where, params } = whereClause(filters);
  const [countRes, res] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM books ${where}`)
      .bind(...params)
      .first<any>(),
    env.DB.prepare(`SELECT * FROM books ${where} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`)
      .bind(...params, pageSize, (pageNum - 1) * pageSize)
      .all(),
  ]);
  const totalCount = countRes?.n ?? 0;
  return {
    books: res?.results ?? [],
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    totalCount,
  };
}

export async function getBookStats(env: any) {
  const [genreRes, authorRes, statsRes] = await Promise.all([
    env.DB.prepare("SELECT genre, COUNT(*) AS n FROM books WHERE status = 'tengo' AND genre IS NOT NULL GROUP BY genre ORDER BY n DESC").all(),
    env.DB.prepare("SELECT author, COUNT(*) AS n FROM books WHERE status = 'tengo' AND author IS NOT NULL GROUP BY author ORDER BY n DESC").all(),
    env.DB.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN price_paid IS NOT NULL THEN price_paid ELSE 0 END) AS totalPaid,
         SUM(CASE WHEN price_paid IS NOT NULL THEN 1 ELSE 0 END) AS withPrice,
         SUM(CASE WHEN price_paid IS NOT NULL THEN price_paid WHEN price_current IS NOT NULL THEN price_current ELSE 0 END) AS totalEstimated,
         SUM(CASE WHEN price_paid IS NOT NULL OR price_current IS NOT NULL THEN 1 ELSE 0 END) AS withAnyPrice
       FROM books WHERE status = 'tengo'`
    ).first<any>(),
  ]);
  return {
    genreCloud: (genreRes?.results ?? []).map((r: any) => [r.genre as string, r.n as number] as [string, number]),
    authorCloud: (authorRes?.results ?? []).map((r: any) => [r.author as string, r.n as number] as [string, number]),
    totalBooks: statsRes?.total ?? 0,
    totalPaid: statsRes?.totalPaid ?? 0,
    booksWithPrice: statsRes?.withPrice ?? 0,
    totalEstimated: statsRes?.totalEstimated ?? 0,
    withAnyPrice: statsRes?.withAnyPrice ?? 0,
  };
}

// Wishlist: books marked 'quiero', optionally scoped to one author/series collection tracker
// (e.g. "faltan N de Rick Riordan"). Ordered by reading_order so a series reads in sequence.
export async function getWishlist(env: any, authorLike?: string) {
  const where = authorLike ? "WHERE status = 'quiero' AND author LIKE ?" : "WHERE status = 'quiero'";
  const res = authorLike
    ? await env.DB.prepare(`SELECT * FROM books ${where} ORDER BY reading_order ASC, id ASC`).bind(`%${authorLike}%`).all()
    : await env.DB.prepare(`SELECT * FROM books ${where} ORDER BY reading_order ASC, id ASC`).all();
  return res?.results ?? [];
}

export async function countMissing(env: any, authorLike: string) {
  const res = await env.DB.prepare("SELECT COUNT(*) AS n FROM books WHERE status = 'quiero' AND author LIKE ?")
    .bind(`%${authorLike}%`)
    .first<any>();
  return res?.n ?? 0;
}

export async function getBookQuotes(env: any) {
  const res = await env.DB.prepare("SELECT * FROM book_quotes ORDER BY sort_order ASC, id ASC").all();
  return res?.results ?? [];
}

export function cloudSize(count: number, max: number) {
  const min = 0.72;
  const scale = 1.35;
  return (min + (count / Math.max(1, max)) * scale).toFixed(2);
}

export function cloudWeight(count: number) {
  if (count >= 5) return 700;
  if (count >= 3) return 600;
  return 400;
}

export function cloudColor(count: number) {
  return count >= 2 ? "var(--ember)" : "var(--ink-soft)";
}

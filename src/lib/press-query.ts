// Shared between the admin advanced-search panel (search-preview.ts) and the weekly Brave
// cron sweep (press-web-search.ts, which re-runs every saved search) — one query-building rule
// so a saved search behaves identically whether it's run by hand or by the cron.
export function buildBraveQuery(include: string[], exclude: string[]): string {
  const quote = (term: string) => (term.includes(" ") ? `"${term}"` : term);
  const includePart = include.map(quote).join(" ");
  const excludePart = exclude.map((term) => `-${quote(term)}`).join(" ");
  return [includePart, excludePart].filter(Boolean).join(" ");
}

export const KNOWN_EXCLUSIONS = ["cantautor", "venezolano", "IGNIA VC", "Octapus", "Finsus"];

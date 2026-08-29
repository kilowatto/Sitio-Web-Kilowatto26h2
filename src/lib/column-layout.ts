// Interleaves a column's infographic/illustration into its body_html as full-width breaks
// between sections, instead of dumping them in a gallery after the whole article. One shared
// function so every column (current and future, any language) gets the same placement logic —
// a real template, not a per-column decision.
// NOTE: any new top-level block tag added to a column's body_html (e.g. the scroll-bar-chart
// widget) MUST be added here too — bodyHtml.match() only returns matched substrings, so any
// content between matches (an unmatched tag) is silently dropped when the blocks are rejoined
// below. Confirmed live 2026-07-28: the chart div vanished entirely from a published column
// until <div class="scroll-bar-chart"...> was added to this pattern.
const BLOCK_RE = /<h2>[\s\S]*?<\/h2>|<ul>[\s\S]*?<\/ul>|<p[^>]*>[\s\S]*?<\/p>|<div class="scroll-bar-chart"[\s\S]*?<\/div>/g;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function breakFigure(url: string, alt: string): string {
  return `<figure class="column-break-img"><img src="${url}" alt="${esc(alt)}" loading="lazy" /></figure>`;
}

export interface ColumnBreakImages {
  /**
   * Marcador que la página sustituye por un <ChartCard> real.
   *
   * Cuando existe, ocupa el lugar de la infografía en vez de su PNG: son los mismos números,
   * pero el componente los dibuja como SVG y les cuelga debajo su tabla accesible en <details>.
   * El PNG no la tiene, y hasta hoy era lo único que veía quien lee una columna con lector de
   * pantalla, con RSS o desde un motor de respuestas -- pese a que los datos llevan desde la
   * migración 0079 estructurados en column_charts.
   */
  chartMarker?: string | null;
  infographicUrl?: string | null;
  illustrationUrl?: string | null;
  alt?: string;
}

export function renderColumnBody(bodyHtml: string, images: ColumnBreakImages): string {
  const blocks = bodyHtml.match(BLOCK_RE);
  if (!blocks || blocks.length === 0) return bodyHtml;
  const n = blocks.length;

  // Valid insertion gaps: never right before block 0, never right after a bare <h2> (an image
  // shouldn't sit directly under a heading with no text under it yet).
  const candidates: number[] = [];
  for (let i = 1; i < n; i++) {
    if (blocks[i - 1].startsWith("<h2>")) continue;
    candidates.push(i);
  }

  function nearest(target: number, used: Set<number>): number | null {
    const pool = candidates.filter((i) => !used.has(i));
    if (pool.length === 0) return null;
    pool.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
    return pool[0];
  }

  const used = new Set<number>();
  const inserts = new Map<number, string[]>();
  const addInsert = (index: number, html: string) => {
    if (!inserts.has(index)) inserts.set(index, []);
    inserts.get(index)!.push(html);
  };

  const alt = images.alt ?? "";
  // El marcador de gráfica sustituye a la infografía cuando la columna tiene datos en
  // column_charts; si no los tiene, todo sigue exactamente como antes.
  const infographic = images.chartMarker ?? (images.infographicUrl ? breakFigure(images.infographicUrl, alt) : null);
  if (infographic && images.illustrationUrl) {
    const first = nearest(Math.round(n / 3), used);
    if (first !== null) {
      used.add(first);
      addInsert(first, infographic);
    }
    const second = nearest(Math.round((2 * n) / 3), used);
    if (second !== null) {
      used.add(second);
      addInsert(second, breakFigure(images.illustrationUrl, alt));
    }
  } else {
    const only = infographic ?? (images.illustrationUrl ? breakFigure(images.illustrationUrl, alt) : null);
    if (only) {
      const mid = nearest(Math.round(n / 2), used);
      if (mid !== null) addInsert(mid, only);
    }
  }

  let out = "";
  blocks.forEach((block, i) => {
    out += block + "\n";
    const ins = inserts.get(i + 1);
    if (ins) out += ins.join("\n") + "\n";
  });
  return out;
}

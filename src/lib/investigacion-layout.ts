// Splits an investigación's body_html on explicit chart placeholders
// (`<!--chart:chart-key-->`) and returns the text segments plus which chart
// goes in each gap. Unlike columns (which guess a good spot for 1-2 images),
// investigaciones place charts at exact narrative points chosen at ingest
// time, so this is a plain split, not a heuristic.
export interface InvestigacionSegment {
  html: string;
  chartKeyAfter: string | null;
}

const PLACEHOLDER_RE = /<!--chart:([a-z0-9-]+)-->/g;

export function splitInvestigacionBody(bodyHtml: string): InvestigacionSegment[] {
  const segments: InvestigacionSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((match = PLACEHOLDER_RE.exec(bodyHtml)) !== null) {
    segments.push({ html: bodyHtml.slice(lastIndex, match.index), chartKeyAfter: match[1] });
    lastIndex = PLACEHOLDER_RE.lastIndex;
  }
  segments.push({ html: bodyHtml.slice(lastIndex), chartKeyAfter: null });
  return segments;
}

// Section headings (h2) become the anchors the sidebar TOC scroll-spies and
// jumps to. Extracted from the already-split segments so ids stay in sync
// with what's actually rendered.
export interface InvestigacionSection {
  id: string;
  title: string;
}

const H2_RE = /<h2([^>]*)>([\s\S]*?)<\/h2>/;

export function extractSections(bodyHtml: string): InvestigacionSection[] {
  const sections: InvestigacionSection[] = [];
  const h2All = bodyHtml.match(/<h2[^>]*>[\s\S]*?<\/h2>/g) ?? [];
  h2All.forEach((h2, i) => {
    const m = h2.match(H2_RE);
    const attrs = m?.[1] ?? "";
    const title = (m?.[2] ?? "").replace(/<[^>]+>/g, "").trim();
    const idMatch = attrs.match(/id="([^"]+)"/);
    const id = idMatch?.[1] ?? `s${i + 1}-${slugify(title)}`;
    sections.push({ id, title });
  });
  return sections;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Stamps an id="" onto every <h2> in order, matching extractSections()'s ids
// exactly, so the TOC's anchor links and scroll-spy targets always agree.
export function stampSectionIds(bodyHtml: string): string {
  let i = 0;
  return bodyHtml.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/g, (_all, attrs, inner) => {
    const title = inner.replace(/<[^>]+>/g, "").trim();
    const id = `s${++i}-${slugify(title)}`;
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });
}

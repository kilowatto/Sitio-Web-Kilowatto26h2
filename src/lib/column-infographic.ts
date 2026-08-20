// Real, code-drawn bar-chart SVG for column infographics — deliberately NOT an AI-generated
// image. AI image models (confirmed repeatedly in brand-image.ts) can't reliably render legible
// numbers/text, and an infographic's whole job is showing correct numbers. This guarantees
// exact figures, crisp text, and on-brand colors, at the cost of only supporting a simple
// horizontal bar-chart shape — fine for the "compare N things" case columns actually need.
export interface InfographicBar {
  label: string;
  value: number;
  displayValue: string; // e.g. "10x" — shown at the end of the bar
}

export interface InfographicOptions {
  title: string;
  subtitle?: string;
  bars: InfographicBar[];
}

const WIDTH = 900;
const BAR_HEIGHT = 48;
const BAR_GAP = 24;
const LABEL_WIDTH = 220;
const CHART_RIGHT_MARGIN = 90;
const TOP_MARGIN = 120;
const BOTTOM_MARGIN = 40;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderInfographicSvg(opts: InfographicOptions): string {
  const { title, subtitle, bars } = opts;
  const maxValue = Math.max(...bars.map((b) => b.value), 1);
  const chartWidth = WIDTH - LABEL_WIDTH - CHART_RIGHT_MARGIN;
  const height = TOP_MARGIN + bars.length * (BAR_HEIGHT + BAR_GAP) + BOTTOM_MARGIN;

  const barsSvg = bars
    .map((b, i) => {
      const y = TOP_MARGIN + i * (BAR_HEIGHT + BAR_GAP);
      const w = Math.max(8, (b.value / maxValue) * chartWidth);
      return `
    <text x="${LABEL_WIDTH - 16}" y="${y + BAR_HEIGHT / 2 + 7}" text-anchor="end" font-family="Sora, sans-serif" font-size="22" font-weight="600" fill="#16130f">${esc(b.label)}</text>
    <rect x="${LABEL_WIDTH}" y="${y}" width="${w}" height="${BAR_HEIGHT}" rx="8" fill="#ff5f14" />
    <text x="${LABEL_WIDTH + w + 14}" y="${y + BAR_HEIGHT / 2 + 7}" font-family="Sora, sans-serif" font-size="24" font-weight="700" fill="#b83b09">${esc(b.displayValue)}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
  <rect width="${WIDTH}" height="${height}" fill="#ffffff" />
  <text x="48" y="56" font-family="Fraunces, serif" font-size="34" font-weight="700" fill="#16130f">${esc(title)}</text>
  ${subtitle ? `<text x="48" y="88" font-family="Sora, sans-serif" font-size="18" fill="#4a4238">${esc(subtitle)}</text>` : ""}
  ${barsSvg}
</svg>`;
}

export async function saveInfographic(env: any, opts: InfographicOptions): Promise<string> {
  const svg = renderInfographicSvg(opts);
  const key = `photos/columns/${crypto.randomUUID()}.svg`;
  await env.MEDIA.put(key, svg, { httpMetadata: { contentType: "image/svg+xml" } });
  return key;
}

// Dataset JSON-LD per chart, per docs/investigaciones-spec.md's "posiblemente Dataset para
// las gráficas" GEO goal -- one Dataset per chart (not one per piece) so each data
// visualization is independently citable/findable, linked back to the Report via isPartOf.
// Each chart already renders its title/description/data visibly on the page (ChartCard),
// which is what makes emitting Dataset structured data for it legitimate.

// Generic short-string extraction (category/series/axis labels) -- same walk-any-shape
// approach as investigacion-translate.ts's collectStrings, but filtered to short label-like
// strings only (skips long prose so variableMeasured doesn't fill up with descriptions).
function collectLabels(node: any, out: string[], seen: Set<string>): void {
  if (typeof node === "string") {
    const s = node.trim();
    if (s && s.length <= 60 && !/^\d+$/.test(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  } else if (Array.isArray(node)) {
    for (const v of node) collectLabels(v, out, seen);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) collectLabels(v, out, seen);
  }
}

export interface DatasetChartInput {
  chartKey: string;
  title: string;
  description: string | null;
  data: any;
}

export function buildChartDatasetJsonLd(
  charts: DatasetChartInput[],
  reportUrl: string,
  reportHeadline: string,
  locale: string
): Record<string, any>[] {
  return charts.map((c) => {
    const labels: string[] = [];
    collectLabels(c.data, labels, new Set());
    return {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: c.title,
      description: c.description || `Datos de la gráfica "${c.title}", de la investigación "${reportHeadline}".`,
      url: `${reportUrl}#chart-${c.chartKey}`,
      inLanguage: locale,
      creator: { "@type": "Person", name: "Esteban Rey", alternateName: "Kilowatto", url: "https://kilowatto.com" },
      isPartOf: { "@type": "Report", "@id": reportUrl, headline: reportHeadline },
      variableMeasured: labels.slice(0, 15),
    };
  });
}

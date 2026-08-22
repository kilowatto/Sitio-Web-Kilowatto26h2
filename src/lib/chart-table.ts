import type { ChartType } from "../components/charts/ChartCard.astro";

// Turns any chart's data into a plain headers+rows table.
//
// This is the accessible alternative WCAG 1.1.1 asks for on a complex image, and the W3C's
// guidance for complex images is exactly this shape: a short label plus a full alternative
// available to EVERYONE, not hidden behind assistive tech. It also happens to be the only form
// of the chart that survives an RSS reader, a text browser, or an answer engine — all of which
// see the SVG/CSS chart as nothing at all.
//
// Rendered server-side from the same `data` the chart uses, so the table can never disagree
// with the picture.

export interface ChartTable {
  headers: string[];
  rows: string[][];
}

function num(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

// Prefer the chart's own formatted label ("90%", "-8.1%") over the raw number: it carries the
// unit and the sign convention the author intended.
function display(v: any, fallback: unknown): string {
  return typeof v === "string" && v.trim() ? v : num(fallback);
}

export function chartToTable(chartType: ChartType, data: any): ChartTable | null {
  if (!data || typeof data !== "object") return null;

  try {
    switch (chartType) {
      case "bar": {
        const items = data.items ?? [];
        if (items.length === 0) return null;
        // Grouped bars carry a name per series; single-value bars don't.
        const seriesNames: string[] = items[0]?.values?.map((v: any, i: number) => v.name ?? `Valor ${i + 1}`) ?? [];
        const multi = seriesNames.length > 1;
        return {
          headers: multi ? ["Concepto", ...seriesNames] : ["Concepto", data.unit ? `Valor (${data.unit})` : "Valor"],
          rows: items.map((it: any) => [
            String(it.label ?? ""),
            ...(it.values ?? []).map((v: any) => display(v.displayValue, v.value)),
          ]),
        };
      }

      case "donut": {
        const segs = data.segments ?? [];
        if (segs.length === 0) return null;
        return {
          headers: ["Segmento", "Valor"],
          rows: segs.map((s: any) => [String(s.label ?? ""), display(s.displayValue, s.value)]),
        };
      }

      case "gauge":
        if (data.value === undefined) return null;
        return {
          headers: ["Indicador", "Valor"],
          rows: [[String(data.label ?? ""), display(data.displayValue, data.value)]],
        };

      case "timeline": {
        const events = data.events ?? [];
        if (events.length === 0) return null;
        return {
          headers: ["Año", "Hecho"],
          rows: events.map((e: any) => [String(e.year ?? ""), String(e.label ?? "")]),
        };
      }

      case "radar": {
        const axes = data.axes ?? [];
        const series = data.series ?? [];
        if (axes.length === 0) return null;
        // Axes become rows so a long axis label wraps in a cell instead of forcing a wide table.
        return {
          headers: ["Eje", ...series.map((s: any, i: number) => String(s.name ?? `Serie ${i + 1}`))],
          rows: axes.map((axis: string, i: number) => [
            String(axis),
            ...series.map((s: any) => num(s.values?.[i])),
          ]),
        };
      }

      case "dumbbell": {
        const items = data.items ?? [];
        if (items.length === 0) return null;
        return {
          headers: ["Concepto", String(data.fromName ?? "Desde"), String(data.toName ?? "Hasta")],
          rows: items.map((it: any) => [
            String(it.label ?? ""),
            display(it.fromLabel, it.from),
            display(it.toLabel, it.to),
          ]),
        };
      }

      case "heatmap": {
        const rows = data.rows ?? [];
        const cols = data.cols ?? [];
        const values = data.values ?? [];
        if (rows.length === 0 || cols.length === 0) return null;
        return {
          headers: ["", ...cols.map(String)],
          rows: rows.map((r: string, ri: number) => [
            String(r),
            ...cols.map((_: string, ci: number) => num(values?.[ri]?.[ci])),
          ]),
        };
      }

      case "table":
        if (!Array.isArray(data.rows) || data.rows.length === 0) return null;
        // Already a table; pass it through rather than inventing a second rendering of it.
        return {
          headers: (data.headers ?? []).map(String),
          rows: data.rows.map((r: any[]) => r.map((c) => String(c ?? ""))),
        };

      case "line": {
        const series = data.series ?? [];
        const labels = data.labels ?? data.xLabels ?? [];
        if (series.length === 0 || labels.length === 0) return null;
        return {
          headers: [String(data.xName ?? ""), ...series.map((s: any, i: number) => String(s.name ?? `Serie ${i + 1}`))],
          rows: labels.map((l: any, i: number) => [
            String(l),
            ...series.map((s: any) => num(s.values?.[i] ?? s.points?.[i]?.y)),
          ]),
        };
      }

      case "scatter": {
        const points = data.points ?? [];
        if (points.length === 0) return null;
        return {
          headers: [String(data.xName ?? "X"), String(data.yName ?? "Y"), "Etiqueta"],
          rows: points.map((p: any) => [num(p.x), num(p.y), String(p.label ?? "")]),
        };
      }

      case "funnel": {
        const steps = data.steps ?? data.items ?? [];
        if (steps.length === 0) return null;
        return {
          headers: ["Etapa", "Valor"],
          rows: steps.map((s: any) => [String(s.label ?? ""), display(s.displayValue, s.value)]),
        };
      }

      case "treemap": {
        const items = data.items ?? data.nodes ?? [];
        if (items.length === 0) return null;
        return {
          headers: ["Concepto", "Valor"],
          rows: items.map((it: any) => [String(it.label ?? it.name ?? ""), display(it.displayValue, it.value)]),
        };
      }

      // "cards" is prose grouped under headings, not tabular data. Forcing it into a grid would
      // read worse than the cards themselves, and the text is already in the DOM and readable.
      case "cards":
      default:
        return null;
    }
  } catch {
    // A malformed data_json must never take an article page down over an optional affordance.
    return null;
  }
}

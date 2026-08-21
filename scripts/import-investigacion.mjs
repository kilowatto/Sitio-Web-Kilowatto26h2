#!/usr/bin/env node
// Parses an "A fondo" markdown file (Esteban's authoring format -- see
// docs/investigaciones/*.md for the reference shape) into a SQL seed file
// that inserts it into `investigaciones` + `investigacion_sources` +
// `investigacion_charts`. Meant to be reusable for every future piece, not
// just this first one -- keep the parsing general, not VPN-specific.
//
// Usage: node scripts/import-investigacion.mjs <input.md> <slug> > seed.sql
// Then:  npx wrangler d1 execute kilowatto-db --local --file=seed.sql
//        npx wrangler d1 execute kilowatto-db --remote --file=seed.sql

import fs from "node:fs";

const [, , inputPath, slugArg] = process.argv;
if (!inputPath || !slugArg) {
  console.error("usage: node scripts/import-investigacion.mjs <input.md> <slug>");
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, "utf8");
const lines = raw.split("\n");

function sqlEsc(s) {
  return String(s ?? "").replace(/'/g, "''");
}

function mdInlineToHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;br&gt;/g, "<br>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

// --- pass 1: pull out title / hook / byline, find section boundaries -------
let i = 0;
while (lines[i] !== undefined && !lines[i].startsWith("# ")) i++;
const title = lines[i].replace(/^#\s+/, "").trim();
i++;
while (lines[i] !== undefined && lines[i].trim() === "") i++;
let hook = "";
if (lines[i]?.startsWith("### ")) {
  hook = lines[i].replace(/^###\s+/, "").trim();
  i++;
}
while (lines[i] !== undefined && lines[i].trim() === "") i++;
let byline = "";
if (lines[i]?.startsWith("**")) {
  byline = lines[i].trim();
  i++;
}

const body = lines.slice(i).join("\n");

// --- helpers to pull out named top-level sections ---------------------------
function sectionBody(heading, source) {
  const re = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "m");
  const m = source.match(re);
  return m ? m[1].trim() : "";
}

const resumenBlock = sectionBody("Resumen ejecutivo", body);
const summary = resumenBlock.split("\n").filter((l) => l.trim() && !l.startsWith("---"))[0] ?? "";

const metodologiaRaw = sectionBody("Metodología de investigación", body);
const fuentesRaw = sectionBody("Fuentes", body);

// Main narrative = everything between the resumen block and "## Metodología"
const mainStart = body.indexOf(resumenBlock) + resumenBlock.length;
const metaHeadingIdx = body.indexOf("## Metodología de investigación");
const narrative = body.slice(mainStart, metaHeadingIdx > -1 ? metaHeadingIdx : undefined);

// --- citation links: [emoji](url) immediately followed by "(Source, Year)" -
const FLAG_MAP = { "🟢": "green", "🟡": "yellow", "🔴": "red" };
const CITE_RE = /\[(🟢|🟡|🔴)\]\((https?:\/\/[^\s)]+)\)\s*(\([^)]*\))/g;

// Same alphabet as src/lib/short-links.ts (no 0/O/1/l/I) -- generated here
// instead of through a live Workers request, since slug generation has no
// real dependency on the runtime.
const SLUG_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const usedSlugs = new Set();
function randomSlug(length = 6) {
  let slug;
  do {
    slug = Array.from({ length }, () => SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)]).join("");
  } while (usedSlugs.has(slug));
  usedSlugs.add(slug);
  return slug;
}

const sourcesByUrl = new Map(); // url -> { label, confidence, position, slug }
let sourcePos = 0;
function registerCitation(url, confidence, label) {
  if (!sourcesByUrl.has(url)) {
    sourcePos += 1;
    sourcesByUrl.set(url, { label, confidence, position: sourcePos, slug: randomSlug() });
  }
  return sourcesByUrl.get(url);
}

// Pre-pass: register every inline citation (in document order) before
// rendering, so renderCitations() below can point straight at a real
// kilowatto.com/r/xxxx short link instead of a placeholder.
for (const m of narrative.matchAll(CITE_RE)) {
  const [, flag, url, paren] = m;
  registerCitation(url, FLAG_MAP[flag] ?? "green", paren.slice(1, -1));
}

function renderCitations(text) {
  return text.replace(CITE_RE, (_all, flag, url, paren) => {
    const confidence = FLAG_MAP[flag] ?? "green";
    const label = paren.slice(1, -1);
    const source = registerCitation(url, confidence, label);
    return `<a class="cite cite--${confidence}" href="https://kilowatto.com/r/${source.slug}" target="_blank" rel="noopener">${mdInlineToHtml(label)}<span class="cite__flag" aria-hidden="true"></span></a>`;
  });
}

// --- table -> chart data -----------------------------------------------
function parseTable(tableLines) {
  const rows = tableLines
    .filter((l) => l.trim().startsWith("|"))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim())
    );
  const header = rows[0];
  const dataRows = rows.slice(2); // skip header + separator row
  return { header, dataRows };
}

// Ranges like "$40 – $80" or "30–60" strip down to two numbers once
// non-digits are removed by a naive replace -- take the LAST number matched
// instead (the upper bound), which is what a bar's length should represent.
function extractNumber(cell) {
  const matches = cell.match(/[\d.]+/g);
  if (!matches) return 0;
  return parseFloat(matches[matches.length - 1]) || 0;
}

function columnLooksNumeric(dataRows, colIndex) {
  if (dataRows.length === 0) return false;
  return dataRows.every((r) => /\d/.test(r[colIndex] ?? ""));
}

function tableToChartData(header, dataRows) {
  if (header.length === 2) {
    return {
      type: "bar",
      data: {
        items: dataRows.map((r) => ({
          label: r[0],
          values: [{ value: extractNumber(r[1]), displayValue: r[1] }],
        })),
      },
    };
  }
  if (/año|year/i.test(header[0])) {
    return {
      type: "timeline",
      data: {
        events: dataRows.map((r) => ({
          year: r[0],
          label: r[1],
          type:
            /escándalo/i.test(r[2]) ? "escandalo"
            : /legal/i.test(r[2]) ? "legal"
            : /propiedad/i.test(r[2]) ? "propiedad"
            : "correccion",
        })),
      },
    };
  }
  // Every column after the label column numeric -> grouped/single bar with
  // one series per column, named after its header.
  const restNumeric = header.slice(1).every((_, idx) => columnLooksNumeric(dataRows, idx + 1));
  if (restNumeric) {
    return {
      type: "bar",
      data: {
        items: dataRows.map((r) => ({
          label: r[0],
          values: r.slice(1).map((c, idx) => ({
            name: header.length > 2 ? header[idx + 1] : undefined,
            value: extractNumber(c),
            displayValue: c,
          })),
        })),
      },
    };
  }
  // Non-numeric columns -> grouped "chip" cards. Column 1 = chips (comma-
  // separated if it's a list), any further columns become the subtitle.
  return {
    type: "cards",
    data: {
      groups: dataRows.map((r) => ({
        title: r[0],
        subtitle: r.slice(2).join(" · ") || undefined,
        items: r[1].split(/,\s*/),
      })),
    },
  };
}

// --- walk the narrative, splitting into h2 sections and gráfica tables -----
const chartBlocks = [];
let chartCounter = 0;
const narrativeLines = narrative.split("\n");
let bodyHtml = "";
let para = [];

function flushPara() {
  const text = para.join(" ").trim();
  para = [];
  if (!text) return;
  if (text.startsWith("|")) return; // stray table line, handled elsewhere
  bodyHtml += `<p>${renderCitations(mdInlineToHtml(text))}</p>\n`;
}

for (let li = 0; li < narrativeLines.length; li++) {
  const line = narrativeLines[li];
  if (line.startsWith("## ")) {
    flushPara();
    bodyHtml += `<h2>${mdInlineToHtml(line.replace(/^##\s+/, "").trim())}</h2>\n`;
    continue;
  }
  const graficaMatch = line.match(/^\*\*Gr[aá]fica\s+(\d+)\s*[·.-]\s*(.+?)\*\*\s*$/);
  if (graficaMatch) {
    flushPara();
    const chartTitle = graficaMatch[2].trim();
    // collect the following table block
    let tj = li + 1;
    while (narrativeLines[tj] !== undefined && narrativeLines[tj].trim() === "") tj++;
    const tableLines = [];
    while (narrativeLines[tj] !== undefined && narrativeLines[tj].trim().startsWith("|")) {
      tableLines.push(narrativeLines[tj]);
      tj++;
    }
    // skip an optional italic note line right after the table (e.g. "(La versión HTML/PDF...)")
    while (narrativeLines[tj] !== undefined && narrativeLines[tj].trim() === "") tj++;
    if (narrativeLines[tj]?.trim().startsWith("*(")) tj++;
    li = tj - 1;

    const { header, dataRows } = parseTable(tableLines);
    const { type, data } = tableToChartData(header, dataRows);
    chartCounter += 1;
    const chartKey = `grafica-${chartCounter}`;
    chartBlocks.push({ chartKey, chartType: type, title: `Gráfica ${graficaMatch[1]} · ${chartTitle}`, data });
    bodyHtml += `<!--chart:${chartKey}-->\n`;
    continue;
  }
  if (line.match(/^\|.*\|\s*$/)) continue; // stray table lines outside a recognized Gráfica block
  if (line.trim() === "" || line.trim() === "---") {
    flushPara();
    continue;
  }
  para.push(line.trim());
}
flushPara();

// stamp h2 ids the same way investigacion-layout.ts does, so the TOC/anchors agree
function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
let h2i = 0;
bodyHtml = bodyHtml.replace(/<h2>([\s\S]*?)<\/h2>/g, (_all, inner) => {
  const t = inner.replace(/<[^>]+>/g, "").trim();
  const id = `s${++h2i}-${slugify(t)}`;
  return `<h2 id="${id}">${inner}</h2>`;
});

// --- final "números" comparison table -> radar chart ------------------------
const numerosMatch = narrative.match(/## La comparación en números[\s\S]*?\n(\|[\s\S]*?)(?=\n\*\(|\n##|$)/);
let radarChart = null;
if (numerosMatch) {
  const { header, dataRows } = parseTable(numerosMatch[1].split("\n").filter((l) => l.trim()));
  const axes = header.slice(1);
  radarChart = {
    chartKey: "radar-comparativo",
    chartType: "radar",
    title: "Comparación general",
    data: {
      axes,
      series: dataRows.map((r) => ({
        name: r[0],
        // scores are written "6/10" -- take the number before the slash, not
        // extractNumber()'s "last number" (which would grab the /10 itself).
        values: r.slice(1).map((c) => parseFloat(c.split("/")[0].replace(/[^0-9.]/g, "")) || 0),
      })),
    },
  };
}

// --- sources list (bibliography) -- reconcile with inline citations by URL -
const sourceLineRe = /^\d+\.\s+.+?—\s+\[(.+?)\]\((https?:\/\/[^\s)]+)\)/;
fuentesRaw.split("\n").forEach((line) => {
  const m = line.match(sourceLineRe);
  if (!m) return;
  const [, label, url] = m;
  if (!sourcesByUrl.has(url)) registerCitation(url, "green", label);
});

// --- read time -----------------------------------------------------------
const wordCount = raw.split(/\s+/).length;
const readMinutes = Math.max(3, Math.round(wordCount / 220));

// --- emit SQL --------------------------------------------------------------
const slug = slugArg;
const methodologyHtml = metodologiaRaw
  .split("\n\n")
  .map((p) => `<p>${mdInlineToHtml(p.trim())}</p>`)
  .join("\n");

let sql = "";
sql += `INSERT INTO investigaciones (slug, title, subtitle, hook, summary, body_html, methodology_html, read_minutes, status, display_seed)\n`;
sql += `VALUES ('${sqlEsc(slug)}', '${sqlEsc(title)}', NULL, '${sqlEsc(hook)}', '${sqlEsc(mdInlineToHtml(summary))}', '${sqlEsc(bodyHtml)}', '${sqlEsc(methodologyHtml)}', ${readMinutes}, 'draft', 1400);\n\n`;

// Every subsequent INSERT looks the parent row up by slug/short-link-slug
// (both unique) via a subquery instead of last_insert_rowid(), since this
// file runs as a batch of independent statements.
for (const [url, s] of sourcesByUrl) {
  sql += `INSERT INTO short_links (slug, target_url, investigacion_id)\n`;
  sql += `SELECT '${sqlEsc(s.slug)}', '${sqlEsc(url)}', id FROM investigaciones WHERE slug = '${sqlEsc(slug)}';\n`;
}

for (const [url, s] of sourcesByUrl) {
  sql += `INSERT INTO investigacion_sources (investigacion_id, position, label, url, confidence, short_link_id)\n`;
  sql += `SELECT i.id, ${s.position}, '${sqlEsc(s.label)}', '${sqlEsc(url)}', '${s.confidence}', sl.id\n`;
  sql += `FROM investigaciones i, short_links sl WHERE i.slug = '${sqlEsc(slug)}' AND sl.slug = '${sqlEsc(s.slug)}';\n`;
}

for (const c of [...chartBlocks, ...(radarChart ? [radarChart] : [])]) {
  sql += `INSERT INTO investigacion_charts (investigacion_id, chart_key, chart_type, title, data_json, position)\n`;
  sql += `SELECT id, '${sqlEsc(c.chartKey)}', '${c.chartType}', '${sqlEsc(c.title)}', '${sqlEsc(JSON.stringify(c.data))}', ${chartBlocks.indexOf(c) > -1 ? chartBlocks.indexOf(c) : 999} FROM investigaciones WHERE slug = '${sqlEsc(slug)}';\n`;
}

process.stdout.write(sql);
console.error(`parsed: title="${title}", ${sourcesByUrl.size} sources, ${chartBlocks.length} inline charts${radarChart ? " + 1 radar" : ""}, ~${readMinutes} min read`);

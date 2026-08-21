#!/usr/bin/env node
// Structured counterpart to import-investigacion.mjs -- takes a JSON payload
// (produced by the "Ensamblar" phase of the investigacion Workflow, see
// .claude/workflows/investigacion.js) instead of parsing Esteban's authoring
// markdown. No heuristics: the writer/chart agents already emit exactly the
// shape the DB wants, so this is a straight structural -> SQL translation.
//
// Usage: node scripts/insert-investigacion.mjs <payload.json> > seed.sql
// Then:  npx wrangler d1 execute kilowatto-db --remote --file=seed.sql
//
// Payload contract (see .claude/workflows/investigacion.js for the prompt
// that produces it):
//   {
//     slug, title, subtitle, hook, summary, bodyHtml, methodologyHtml,
//     readMinutes, displaySeed?,
//     sources: [{ url, label, confidence: "green"|"yellow"|"red" }],
//     charts: [{ chartKey, chartType, title, description, sourceNote, data, position }]
//   }
//
// bodyHtml citation markers: `__CITE__{n}__` where n is the 0-based index
// into `sources` -- replaced here with a real kilowatto.com/r/xxxx short
// link. bodyHtml chart placeholders: `<!--chart:{chartKey}-->`, one per
// non-radar chart. The radar chart (chartKey must be exactly
// "radar-comparativo") is rendered at a fixed spot by [param].astro and
// must NOT have a placeholder in bodyHtml.

import fs from "node:fs";

const [, , inputPath] = process.argv;
if (!inputPath) {
  console.error("usage: node scripts/insert-investigacion.mjs <payload.json>");
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));

function sqlEsc(s) {
  return String(s ?? "").replace(/'/g, "''");
}

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

const { slug, title, subtitle, hook, summary, methodologyHtml, readMinutes, displaySeed, sources, charts } = payload;

if (!slug || !title || !payload.bodyHtml || !Array.isArray(sources) || !Array.isArray(charts)) {
  console.error("payload missing required fields (slug, title, bodyHtml, sources[], charts[])");
  process.exit(1);
}

const nonRadarCharts = charts.filter((c) => c.chartKey !== "radar-comparativo");
const radarChart = charts.find((c) => c.chartKey === "radar-comparativo") ?? null;

const distinctTypes = new Set(charts.map((c) => c.chartType));
if (!radarChart) console.error("WARNING: no radar-comparativo chart in payload -- methodology requires one always.");
if (distinctTypes.size < 6) console.error(`WARNING: only ${distinctTypes.size} distinct chart types (methodology requires >= 6).`);
if (!charts.some((c) => c.chartType === "table")) console.error("WARNING: no table chart in payload -- methodology requires at least one.");

// Assign a real short-link slug per source, in payload order (index n matches __CITE__{n}__).
const sourceSlugs = sources.map(() => randomSlug());

let bodyHtml = payload.bodyHtml.replace(/__CITE__(\d+)__/g, (_all, nStr) => {
  const n = Number(nStr);
  const s = sources[n];
  if (!s) {
    console.error(`WARNING: __CITE__${n}__ has no matching sources[${n}] -- left the token's target URL as "#".`);
    return "#";
  }
  return `https://kilowatto.com/r/${sourceSlugs[n]}`;
});

for (const c of nonRadarCharts) {
  if (!bodyHtml.includes(`<!--chart:${c.chartKey}-->`)) {
    console.error(`WARNING: chart "${c.chartKey}" has no <!--chart:${c.chartKey}--> placeholder in bodyHtml.`);
  }
}

const wordCount = bodyHtml.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

let sql = "";
sql += `INSERT INTO investigaciones (slug, title, subtitle, hook, summary, body_html, methodology_html, read_minutes, status, display_seed)\n`;
sql += `VALUES ('${sqlEsc(slug)}', '${sqlEsc(title)}', ${subtitle ? `'${sqlEsc(subtitle)}'` : "NULL"}, ${hook ? `'${sqlEsc(hook)}'` : "NULL"}, '${sqlEsc(summary)}', '${sqlEsc(bodyHtml)}', '${sqlEsc(methodologyHtml ?? "")}', ${readMinutes ?? Math.max(3, Math.round(wordCount / 220))}, 'pending_approval', ${displaySeed ?? 250});\n\n`;

sources.forEach((s, n) => {
  sql += `INSERT INTO short_links (slug, target_url, investigacion_id)\n`;
  sql += `SELECT '${sqlEsc(sourceSlugs[n])}', '${sqlEsc(s.url)}', id FROM investigaciones WHERE slug = '${sqlEsc(slug)}';\n`;
});

sources.forEach((s, n) => {
  sql += `INSERT INTO investigacion_sources (investigacion_id, position, label, url, confidence, short_link_id)\n`;
  sql += `SELECT i.id, ${n + 1}, '${sqlEsc(s.label)}', '${sqlEsc(s.url)}', '${s.confidence}', sl.id\n`;
  sql += `FROM investigaciones i, short_links sl WHERE i.slug = '${sqlEsc(slug)}' AND sl.slug = '${sqlEsc(sourceSlugs[n])}';\n`;
});

charts.forEach((c, idx) => {
  sql += `INSERT INTO investigacion_charts (investigacion_id, chart_key, chart_type, title, description, data_json, source_note, position)\n`;
  sql += `SELECT id, '${sqlEsc(c.chartKey)}', '${sqlEsc(c.chartType)}', '${sqlEsc(c.title)}', ${c.description ? `'${sqlEsc(c.description)}'` : "NULL"}, '${sqlEsc(JSON.stringify(c.data))}', ${c.sourceNote ? `'${sqlEsc(c.sourceNote)}'` : "NULL"}, ${c.position ?? idx}\n`;
  sql += `FROM investigaciones WHERE slug = '${sqlEsc(slug)}';\n`;
});

process.stdout.write(sql);
console.error(
  `parsed: title="${title}", ${sources.length} sources, ${charts.length} charts (${distinctTypes.size} distinct types${radarChart ? " incl. radar" : ", NO RADAR"}), ~${wordCount} words -> status pending_approval`
);

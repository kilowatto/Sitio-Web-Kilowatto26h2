import { env } from "cloudflare:workers";
import { webSearch } from "./web-search";
import { snapshotArticle } from "./press-snapshot";
import { extractThumbnail } from "./html-text";

const USER_AGENT = "Mozilla/5.0 (compatible; KilowattoBot/1.0; +https://kilowatto.com)";

// Esteban's own weekly Perplexity prompt (2026-07-25), split into two lists with different
// handling — NOT one shared list, this distinction is load-bearing:
//
// PUBLIC_ENTITIES: businesses/projects that could plausibly surface real press coverage worth
// eventually publishing on /prensa (still goes through the same manual pending-review queue,
// never auto-published).
//
// PRIVATE_ENTITIES: names Esteban confirmed should be treated with the same hard privacy rule
// as his family (see privacy_rules_kilowatto memory / docs/reglas-editoriales-privacidad.md) —
// never public, ever. Rows matched against these are hard-flagged `is_family_private = 1` in
// press-mentions.ts's approve.ts, which REFUSES to publish them regardless of admin token. This
// is a structural guard, not just a UI convention — don't remove it when touching this file.
const PUBLIC_ENTITIES = [
  "Ignia Cloud",
  "Ignia Cloud LLC",
  "Finsus",
  "Financiera Sustentable",
  "Orange Rhino",
  "Orange Rhino Investments",
  "Pilou",
  "Frida Café",
  "Bari Restaurant",
  "Georgia James Restaurant Houston",
  "GFI School Academy",
  "GFI Soccer",
  "Yucatech Festival",
  "assouline México",
  "assouline Los Cabos",
];

const PRIVATE_ENTITIES = ["Inigo Rey", "Inigo Rey Ortega", "Sebastián Rey", "Sebastián Rey Ortega"];

// Most PUBLIC_ENTITIES are literal proper names — real coverage says the words together, in
// order ("Bari Restaurant", not "Restaurant Bari in Neukölln"). Confirmed live 2026-07-27: an
// anywhere-in-document AND check let through a Berlin restaurant called "Bari" (Esteban's Bari
// is in Houston/The Woodlands) precisely because word order/adjacency wasn't required. The two
// "brand + city" search hints below are the deliberate exception — they're a search strategy,
// not a literal name (no article says "assouline Los Cabos" as a contiguous phrase), so they keep
// the looser anywhere-AND match. Single-word entities (Finsus, Pilou) can't use adjacency at all
// (there's only one word) and stay inherently noisier — no code fix for that without adding a
// disambiguating second term, which needs Esteban's input on what each one actually is.
const LOOSE_MATCH_PUBLIC_ENTITIES = new Set(["assouline México", "assouline Los Cabos", "Georgia James Restaurant Houston"]);

export interface WeeklyBriefingSummary {
  found: number;
  new: number;
  privateFlagged: number;
}

// Brave's own phrase-quote support isn't a hard filter (it still backfills with loosely
// related results when few exact matches exist), and short/common name parts ("Rey", "Sebastián",
// "Iñigo", "Ortega") are each real words/surnames/places on their own — confirmed live 2026-07-27:
// searching "Sebastián Rey Ortega" surfaced Daniel Ortega (Nicaragua), "San Sebastián de los
// Reyes", Rodrigo Rey the footballer, and a stranger's unrelated baby named Íñigo, none of which
// have anything to do with Esteban's family. This second filter requires every significant word
// of the entity to appear as a whole word (accent/case-insensitive) somewhere in the title+snippet
// — "Reyes" does NOT satisfy a "Rey" requirement, since \b won't match mid-word. Applied to both
// lists: the same loose-match flood happened on PUBLIC_ENTITIES too (e.g. "assouline Los Cabos"
// pulling generic Los Cabos municipal news that never mentions Assouline at all).
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// PRIVATE_ENTITIES are real first+last names — "Rey" alone is also the ordinary Spanish word
// for "king", so an anywhere-in-document AND check still let through things like the Disney
// Wiki page for Sebastián the crab ("...ayudante del Rey Tritón...", confirmed live 2026-07-27:
// "Sebastián" and "Rey" both present, just never next to each other). Requiring the words
// adjacent, in order, closes that specific collision without needing a name-vs-word dictionary.
function isRelevantHit(entity: string, title: string, snippet: string, requireAdjacent: boolean): boolean {
  const haystack = stripDiacritics(`${title} ${snippet}`.toLowerCase());
  const words = stripDiacritics(entity.toLowerCase())
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (requireAdjacent) {
    return new RegExp(`\\b${words.join("\\s+")}\\b`).test(haystack);
  }
  return words.every((w) => new RegExp(`\\b${w}\\b`).test(haystack));
}

async function processHit(
  r: { url: string; title: string; snippet: string },
  entity: string,
  isPrivate: boolean,
  summary: WeeklyBriefingSummary
): Promise<void> {
  const existing = await env.DB.prepare("SELECT id FROM press_mentions WHERE url = ?").bind(r.url).first();
  if (existing) return;
  summary.new++;
  if (isPrivate) summary.privateFlagged++;

  let articleHtml: string | null = null;
  try {
    const res = await fetch(r.url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(12_000), redirect: "follow" });
    if (res.ok) articleHtml = await res.text();
  } catch {
    // fall through — still worth recording the hit even without the full page
  }

  // No AI "is this about Esteban" classification here — that classifier (press-classify.ts)
  // is tuned for one specific problem (disambiguating him from same-named people) and doesn't
  // fit "is this genuine coverage of a restaurant/school/company." Esteban reviews these
  // himself; the value here is surfacing candidates, not auto-filtering them.
  const thumbnailUrl = articleHtml ? await extractThumbnail(articleHtml, r.url) : null;

  const inserted = await env.DB.prepare(
    `INSERT INTO press_mentions (url, outlet, title, published_at, summary, identity_confidence, status, thumbnail_url, is_family_private, watch_entity)
     VALUES (?, ?, ?, NULL, ?, 'uncertain', 'pending', ?, ?, ?)`
  )
    .bind(r.url, new URL(r.url).hostname, r.title, r.snippet ?? "", thumbnailUrl, isPrivate ? 1 : 0, entity)
    .run();

  const mentionId = inserted.meta.last_row_id;
  const { r2Key, archiveUrl } = await snapshotArticle(r.url, mentionId, articleHtml ?? undefined);
  if (r2Key || archiveUrl) {
    await env.DB.prepare(`UPDATE press_mentions SET raw_content_r2_key = COALESCE(?, raw_content_r2_key), archive_url = COALESCE(?, archive_url) WHERE id = ?`)
      .bind(r2Key, archiveUrl, mentionId)
      .run();
  }
}

export async function runWeeklyBriefing(): Promise<WeeklyBriefingSummary> {
  const summary: WeeklyBriefingSummary = { found: 0, new: 0, privateFlagged: 0 };

  for (const entity of PUBLIC_ENTITIES) {
    const results = await webSearch(`"${entity}"`, 10, false, "pw");
    summary.found += results.length;
    const strict = !LOOSE_MATCH_PUBLIC_ENTITIES.has(entity) && entity.trim().includes(" ");
    for (const r of results) {
      if (r.url && isRelevantHit(entity, r.title, r.snippet, strict)) await processHit(r, entity, false, summary);
    }
  }

  for (const entity of PRIVATE_ENTITIES) {
    const results = await webSearch(`"${entity}"`, 10, false, "pw");
    summary.found += results.length;
    for (const r of results) {
      if (r.url && isRelevantHit(entity, r.title, r.snippet, true)) await processHit(r, entity, true, summary);
    }
  }

  return summary;
}

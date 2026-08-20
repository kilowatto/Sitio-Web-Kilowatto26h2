import { env } from "cloudflare:workers";
import { fetchGoogleNewsRss, type RssItem } from "./rss";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DAILY_CAP = 4; // total news_reaction drafts created per day, across both platforms — Esteban's call: enough variety to choose from without it feeling like a full-time job to review

// Small, bounded set of queries — NOT one query per curated source (50 separate RSS fetches
// per tick would be slow and wasteful). Instead cast a wide net with a handful of topic/
// competitor queries, then filter results down to only the curated `news_sources` by name —
// the source list is a quality filter, not a query-time restriction.
const BRAND_TOPIC_QUERIES = [
  "cloud computing OR edge computing",
  "inteligencia artificial empresas OR enterprise AI",
  "ciberseguridad empresas OR enterprise cybersecurity",
];
const COMPETITOR_QUERIES = ["AWS OR \"Google Cloud\" OR \"Microsoft Azure\""];
const BRAND_SPECIFIC_QUERIES = ["Yucatech OR \"Mérida tecnología\""];
const BIG_LAUNCH_QUERY = "lanzamiento tecnológico OR \"tech launch\"";

export interface NewsCandidate extends RssItem {
  isBrandTopic: boolean;
}

async function getTrustedSourceNames(): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT name FROM news_sources WHERE trusted = 1").all<any>();
  return (results ?? []).map((r: any) => r.name.toLowerCase());
}

async function alreadySeenUrls(links: string[]): Promise<Set<string>> {
  if (links.length === 0) return new Set();
  const placeholders = links.map(() => "?").join(",");
  const { results } = await env.DB.prepare(`SELECT source_url FROM brand_posts WHERE source_url IN (${placeholders})`)
    .bind(...links)
    .all<any>();
  return new Set((results ?? []).map((r: any) => r.source_url));
}

// Returns fresh, deduped, trusted-source candidates, brand-topic ones first (those get
// full reaction treatment regardless of size; the rest only survive classification if
// they're a genuinely big deal — see classifyCandidate's bigLaunchWorthy).
export async function searchCandidates(): Promise<NewsCandidate[]> {
  const trustedNames = await getTrustedSourceNames();
  if (trustedNames.length === 0) return [];

  const queryGroups: { queries: string[]; isBrandTopic: boolean }[] = [
    { queries: [...BRAND_TOPIC_QUERIES, ...BRAND_SPECIFIC_QUERIES, ...COMPETITOR_QUERIES], isBrandTopic: true },
    { queries: [BIG_LAUNCH_QUERY], isBrandTopic: false },
  ];

  const seenLinks = new Set<string>();
  const candidates: NewsCandidate[] = [];

  for (const group of queryGroups) {
    for (const q of group.queries) {
      let items: RssItem[] = [];
      try {
        items = await fetchGoogleNewsRss(q);
      } catch {
        continue;
      }
      for (const item of items) {
        if (seenLinks.has(item.link)) continue;
        const sourceLower = item.source.toLowerCase();
        const isTrusted = trustedNames.some((name) => sourceLower.includes(name) || name.includes(sourceLower));
        if (!isTrusted) continue;
        seenLinks.add(item.link);
        candidates.push({ ...item, isBrandTopic: group.isBrandTopic });
      }
    }
  }

  const links = candidates.map((c) => c.link);
  const seenInDb = await alreadySeenUrls(links);
  return candidates.filter((c) => !seenInDb.has(c.link)).slice(0, 12);
}

export interface NewsClassification {
  relevant: boolean;
  bigLaunchWorthy: boolean;
  urgency: "breaking" | "analysis";
  neverAuto: boolean;
  summary: string;
}

const CLASSIFY_PROMPT_BASE = `Ayudas a decidir si una noticia de tecnología merece una reacción en redes sociales a nombre de Esteban Rey ("Kilowatto"), CEO de Ignia Cloud (cómputo en la nube), inversionista (Orange Rhino Investments) y fundador del Yucatech Festival.

Excluye SIEMPRE (responde relevant=false) si la noticia es sobre: política partidista, criptomonedas/Web3, o recomendaciones de inversión específicas.

"neverAuto" = true si la noticia es sobre una crisis/escándalo de un competidor específico, o un tema legal/regulatorio — este tipo de post SIEMPRE debe esperar aprobación manual de Esteban, nunca publicarse solo aunque el sistema esté en piloto automático.

"urgency" = "breaking" si es noticia de último momento que pierde sentido en pocas horas (lanzamiento, anuncio puntual); "analysis" si es una tendencia/análisis que sigue siendo relevante por días.

Responde SOLO un JSON: {"relevant": true|false, "bigLaunchWorthy": true|false, "urgency": "breaking"|"analysis", "neverAuto": true|false, "summary": "resumen factual de una oración en español, SOLO con datos que aparezcan en el título — nunca inventes cifras ni detalles"}`;

export async function classifyCandidate(item: NewsCandidate): Promise<NewsClassification | null> {
  const context = item.isBrandTopic
    ? "Esta noticia ya coincide con uno de sus temas de marca (cloud, IA, ciberseguridad, competidores, o Yucatech) — bigLaunchWorthy no aplica aquí, trátala como relevante por default salvo que caiga en una exclusión."
    : "Esta noticia NO es de sus temas de marca — solo es relevant=true si bigLaunchWorthy también es true (es un lanzamiento/anuncio realmente grande de la industria tech, no una nota menor).";

  const prompt = `${CLASSIFY_PROMPT_BASE}\n\n${context}\n\nTítulo: ${item.title}\nFuente: ${item.source}`;

  try {
    const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 250 });
    const raw = typeof result?.response === "object" ? result.response : null;
    if (raw) return raw;
    const match = typeof result?.response === "string" ? result.response.match(/\{[\s\S]*\}/) : null;
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

// Counts STORIES (distinct variant_group), not raw rows — each story inserts 2 variant
// rows (casual + formal) that are really one review decision, not two. Counting raw rows
// would let the daily cap silently mean half as many actual stories as intended.
export async function countTodaysNewsReactions(): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(DISTINCT variant_group) AS n FROM brand_posts WHERE kind = 'news_reaction' AND date(created_at) = date('now')`
  ).first<any>();
  return row?.n ?? 0;
}

export async function platformWithFewerToday(): Promise<"x" | "linkedin"> {
  const { results } = await env.DB.prepare(
    `SELECT platform, COUNT(*) AS n FROM brand_posts WHERE kind = 'news_reaction' AND date(created_at) = date('now') GROUP BY platform`
  ).all<any>();
  const counts: Record<string, number> = { x: 0, linkedin: 0 };
  for (const r of results ?? []) counts[r.platform] = r.n;
  return counts.x <= counts.linkedin ? "x" : "linkedin";
}

export { DAILY_CAP };

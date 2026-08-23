import { env } from "cloudflare:workers";

// Podcast RSS for the narrated catalogue.
//
// Targets Apple's current spec, which is narrower than most guides claim: the only REQUIRED
// channel tags are title, description, itunes:image, language, itunes:category and
// itunes:explicit, and the only required item tags are title, enclosure and guid.
// itunes:summary, itunes:subtitle, itunes:keywords and itunes:owner are absent from the
// current spec entirely -- description carries the text at both levels.
//
// One feed per language: <language> is a channel-level tag, so a bilingual catalogue is two
// shows, not one with mixed episodes.

const SITE = "https://kilowatto.com";

export interface FeedLocale {
  code: string;
  /** RFC 5646 tag for <language>. */
  rss: string;
  title: string;
  description: string;
  path: string;
}

export const FEED_LOCALES: Record<string, FeedLocale> = {
  "es-MX": {
    code: "es-MX",
    rss: "es-mx",
    title: "Kilowatto — Columnas e investigaciones",
    description:
      "Las columnas e investigaciones de Esteban Rey (Kilowatto) sobre tecnología, nube, IA y " +
      "negocios en México y Latinoamérica, narradas en audio. Cada episodio es una pieza " +
      "publicada en kilowatto.com. La narración usa una voz sintética; el texto es de Esteban.",
    path: "/podcast.xml",
  },
  en: {
    code: "en",
    rss: "en",
    title: "Kilowatto — Columns and Deep Dives",
    description:
      "Esteban Rey (Kilowatto) on technology, cloud, AI and business in Mexico and Latin " +
      "America, narrated. Each episode is a piece published on kilowatto.com. The narration " +
      "uses a synthetic voice; the writing is Esteban's.",
    path: "/en/podcast.xml",
  },
};

// Apple's category list is case-sensitive and only the first pair is read.
const CATEGORY = "Technology";
const ARTWORK = `${SITE}/podcast-cover.jpg`;
const AUTHOR = "Esteban Rey";

function esc(s: string): string {
  // Apple wants numeric references, not HTML entity names: &rsquo; and &copy; are rejected.
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// RFC 2822, which the spec requires. Apple's own sample feed violates this with an ISO date --
// don't copy it.
function rfc2822(value: string | null): string {
  const d = value ? new Date(value.includes("T") || value.includes(" ") ? value : `${value}T12:00:00Z`) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${DAYS[safe.getUTCDay()]}, ${p(safe.getUTCDate())} ${MONTHS[safe.getUTCMonth()]} ` +
    `${safe.getUTCFullYear()} ${p(safe.getUTCHours())}:${p(safe.getUTCMinutes())}:${p(safe.getUTCSeconds())} GMT`
  );
}

interface EpisodeRow {
  entity_type: string;
  entity_id: number;
  r2_key: string;
  bytes: number | null;
  duration_s: number | null;
  title: string | null;
  subtitle: string | null;
  slug: string | null;
  published_at: string | null;
}

export async function buildPodcastFeed(localeCode: string): Promise<string | null> {
  const loc = FEED_LOCALES[localeCode];
  if (!loc) return null;

  const rows = await env.DB.prepare(
    `SELECT ma.entity_type, ma.entity_id, ma.r2_key, ma.bytes, ma.duration_s,
            COALESCE(c.title, i.title) AS title,
            COALESCE(c.subtitle, i.subtitle) AS subtitle,
            COALESCE(c.slug, i.slug) AS slug,
            COALESCE(c.published_at, i.published_at) AS published_at
       FROM media_assets ma
       LEFT JOIN columns c         ON ma.entity_type = 'columna'       AND c.id = ma.entity_id
       LEFT JOIN investigaciones i ON ma.entity_type = 'investigacion' AND i.id = ma.entity_id
      WHERE ma.kind = 'audio_narration' AND ma.status = 'ready'
        AND ma.locale = ? AND ma.r2_key IS NOT NULL
      ORDER BY COALESCE(c.published_at, i.published_at) DESC`
  )
    .bind(localeCode)
    .all<EpisodeRow>();

  const episodes = (rows.results ?? []).filter((e) => e.title && e.slug);
  const prefix = localeCode === "es-MX" ? "" : `/${localeCode}`;

  // Titles are translated per locale; pull them so an English feed isn't full of Spanish.
  if (localeCode !== "es-MX" && episodes.length > 0) {
    const tr = await env.DB.prepare(
      `SELECT entity_type, entity_id, field_key, value FROM translations
        WHERE locale = ? AND field_key IN ('title','subtitle')
          AND entity_type IN ('columns','investigaciones')`
    )
      .bind(localeCode)
      .all<{ entity_type: string; entity_id: number; field_key: string; value: string }>();
    const map = new Map(
      (tr.results ?? []).map((t) => [`${t.entity_type}:${t.entity_id}:${t.field_key}`, t.value])
    );
    for (const e of episodes) {
      const table = e.entity_type === "columna" ? "columns" : "investigaciones";
      e.title = map.get(`${table}:${e.entity_id}:title`) ?? e.title;
      e.subtitle = map.get(`${table}:${e.entity_id}:subtitle`) ?? e.subtitle;
    }
  }

  const items = episodes
    .map((e) => {
      const section = e.entity_type === "columna" ? "columnas" : "a-fondo";
      const pageUrl = `${SITE}${prefix}/${section}/${e.slug}`;
      const audioUrl = `${SITE}/media/video/${e.r2_key}`;
      const transcriptUrl = `${pageUrl}/transcripcion.txt`;
      // A stable guid that survives the file being regenerated: keyed on the piece and locale,
      // not on the audio URL, whose hash changes whenever the script is re-narrated.
      const guid = `kilowatto:${e.entity_type}:${e.entity_id}:${localeCode}`;

      return `    <item>
      <title>${esc(e.title)}</title>
      <description>${esc(e.subtitle ?? e.title)}</description>
      <link>${esc(pageUrl)}</link>
      <guid isPermaLink="false">${esc(guid)}</guid>
      <pubDate>${rfc2822(e.published_at)}</pubDate>
      <enclosure url="${esc(audioUrl)}" length="${e.bytes ?? 0}" type="audio/mpeg" />
      <itunes:duration>${Math.round(e.duration_s ?? 0)}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
      <podcast:transcript url="${esc(transcriptUrl)}" type="text/plain" />
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:podcast="https://podcastindex.org/namespace/1.0"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(loc.title)}</title>
    <description>${esc(loc.description)}</description>
    <link>${SITE}${prefix}</link>
    <language>${loc.rss}</language>
    <itunes:author>${esc(AUTHOR)}</itunes:author>
    <itunes:image href="${ARTWORK}" />
    <itunes:category text="${CATEGORY}" />
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <atom:link href="${SITE}${loc.path}" rel="self" type="application/rss+xml" />
    <!-- The narration is synthetic. Declaring it is Esteban's editorial stance and matches the
         disclosure shown on every page and by Larry; podcast:txt purpose="ai-content" is the
         emerging machine-readable signal for it. -->
    <podcast:txt purpose="ai-content">true</podcast:txt>
${items}
  </channel>
</rss>
`;
}

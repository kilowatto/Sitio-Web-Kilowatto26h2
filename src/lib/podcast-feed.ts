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
  /**
   * podcast:guid -- the show's permanent identity, independent of where it is hosted.
   * The namespace spec fixes both the algorithm and the namespace UUID: UUIDv5 over the feed
   * URL with the protocol stripped. Recompute with:
   *   node -e 'const c=require("crypto");const ns=Buffer.from("ead4c236bf5858c6a2c6a6b28d128cb6","hex");
   *   const h=c.createHash("sha1").update(Buffer.concat([ns,Buffer.from(process.argv[1])])).digest();
   *   const b=h.subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;
   *   const x=b.toString("hex");console.log([x.slice(0,8),x.slice(8,12),x.slice(12,16),x.slice(16,20),x.slice(20)].join("-"))' \
   *   kilowatto.com/podcast.xml
   */
  guid: string;
}

export const FEED_LOCALES: Record<string, FeedLocale> = {
  "es-MX": {
    code: "es-MX",
    rss: "es-mx",
    title: "Al fondo con Kilowatto",
    // The title names the conversations, which are 3 of the 26 episodes. That is Esteban's call
    // and the reason is sound -- it is what the ident says out loud, and a show whose name
    // contradicts its own audio is worse. But it does mean the description has to do the work of
    // saying that the full readings are in here too, or a listener who subscribed for 12-minute
    // conversations meets a 64-minute one and thinks something broke.
    description:
      "Kilowatto y Leia conversan sobre las investigaciones de A fondo: tecnología, nube, IA y " +
      "negocios en México y Latinoamérica. El feed lleva además la lectura completa de cada " +
      "investigación y las columnas narradas, todo publicado en kilowatto.com. Los textos son de " +
      "Esteban Rey; las voces son sintéticas.",
    path: "/podcast.xml",
    guid: "357307b7-4568-5d0c-96c1-3d7964c13e60",
  },
  en: {
    code: "en",
    rss: "en",
    title: "Deep Dive with Kilowatto",
    description:
      "Kilowatto and Leia talk through the Deep Dive investigations: technology, cloud, AI and " +
      "business in Mexico and Latin America. The feed also carries the full reading of each " +
      "investigation and the narrated columns, all published on kilowatto.com. The writing is " +
      "Esteban Rey's; the voices are synthetic.",
    path: "/en/podcast.xml",
    guid: "ea0627af-4fdf-57be-9a0b-08475d2fa5ed",
  },
};

// Apple's category list is case-sensitive and only the first pair is read.
const CATEGORY = "Technology";
// The ?v= is not decoration. Apple and Spotify cache artwork by URL and do not re-fetch an
// unchanged one, so replacing the image in R2 leaves the directories showing the old cover
// indefinitely. Bump this on every cover change; it is the only thing that forces a re-read.
// v2 = 2026-08-23, the version without eyeglasses.
const ARTWORK = `${SITE}/podcast-cover.jpg?v=2`;
const AUTHOR = "Esteban Rey";
// The two voices of the conversational episodes. Kilowatto is the brand as a character, hosting
// his own research; Leia is one of Esteban's two ostriches, and the site already describes her as
// the sociable, curious one -- which is the co-host's job. Larry, the rhino, is not in the
// podcast at all: he narrates the columns and the full readings.
const HOST_NAME = "Kilowatto";
const COHOST_NAME = "Leia";
// podcast:locked owner. A hosting platform that receives an import request for this feed is
// expected to mail this address for consent, so it has to be a real mailbox -- and a role
// address on the domain rather than a personal one, since the feed is public.
const OWNER_EMAIL = "larry@kilowatto.com";

// XML forbids "--" anywhere inside a comment, and the feed carries several explanatory ones.
// A double hyphen in one of them takes the WHOLE feed down with a parse error -- which is how
// this rule was learned, live, with both feeds returning unparseable XML.
function xmlComment(text: string): string {
  return `<!-- ${text.replace(/--+/g, "\u2014")} -->`;
}

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
  kind: string;
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

export interface BuiltFeed {
  xml: string;
  /** Newest episode's publication date, for Last-Modified. Stable between publishes, which is
   *  what makes the ETag/304 path below worth anything. */
  lastModified: Date;
}

export async function buildPodcastFeed(localeCode: string): Promise<BuiltFeed | null> {
  const loc = FEED_LOCALES[localeCode];
  if (!loc) return null;

  // Both kinds. Esteban's call: the feed carries the conversation AND the full reading of an
  // investigación, so a listener who wants the whole hour can still get it in their app.
  // 'audio_dialogue' sorts before 'audio_narration', which puts the conversation first within a
  // piece -- the short one is the one most people want.
  const rows = await env.DB.prepare(
    `SELECT ma.kind, ma.entity_type, ma.entity_id, ma.r2_key, ma.bytes, ma.duration_s,
            COALESCE(c.title, i.title) AS title,
            COALESCE(c.subtitle, i.subtitle) AS subtitle,
            COALESCE(c.slug, i.slug) AS slug,
            COALESCE(c.published_at, i.published_at) AS published_at
       FROM media_assets ma
       LEFT JOIN columns c         ON ma.entity_type = 'columna'       AND c.id = ma.entity_id
       LEFT JOIN investigaciones i ON ma.entity_type = 'investigacion' AND i.id = ma.entity_id
      WHERE ma.kind IN ('audio_narration', 'audio_dialogue') AND ma.status = 'ready'
        AND ma.locale = ? AND ma.r2_key IS NOT NULL
      ORDER BY COALESCE(c.published_at, i.published_at) DESC, ma.kind ASC`
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

  // Only label the full reading when the same piece also has a conversation in this feed --
  // otherwise the label distinguishes it from nothing and just makes the title longer.
  const hasDialogue = new Set(
    episodes.filter((e) => e.kind === "audio_dialogue").map((e) => `${e.entity_type}:${e.entity_id}`)
  );

  const items = episodes
    .map((e) => {
      const isDialogue = e.kind === "audio_dialogue";
      const section = e.entity_type === "columna" ? "columnas" : "a-fondo";
      const pageUrl = `${SITE}${prefix}/${section}/${e.slug}`;
      const audioUrl = `${SITE}/media/video/${e.r2_key}`;
      const transcriptUrl = `${pageUrl}/${isDialogue ? "conversacion" : "transcripcion"}.txt`;
      // The two versions of one piece are two episodes and need two guids -- a shared one makes
      // every podcast app treat the second as an edit of the first and hide it. The suffix goes
      // ONLY on the conversation: a guid is an episode's permanent identity, so re-keying the 46
      // narrations that already exist would republish every one of them as new to anyone
      // subscribed. Nobody is subscribed yet, but that is luck, not a reason.
      const guid = isDialogue
        ? `kilowatto:${e.entity_type}:${e.entity_id}:${localeCode}:dialogo`
        : `kilowatto:${e.entity_type}:${e.entity_id}:${localeCode}`;

      const labelled =
        !isDialogue && hasDialogue.has(`${e.entity_type}:${e.entity_id}`)
          ? `${localeCode === "es-MX" ? "Lectura completa" : "Full reading"} — ${e.title}`
          : e.title;
      const blurb = isDialogue
        ? localeCode === "es-MX"
          ? `${HOST_NAME} y ${COHOST_NAME} conversan sobre la investigación. ${e.subtitle ?? ""}`.trim()
          : `${HOST_NAME} and ${COHOST_NAME} talk through the investigation. ${e.subtitle ?? ""}`.trim()
        : (e.subtitle ?? e.title);

      return `    <item>
      <title>${esc(labelled)}</title>
      <description>${esc(blurb)}</description>
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

  // Episodes come back newest-first, so the head of the list dates the feed.
  const newest = episodes[0]?.published_at ?? null;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
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
    <!-- Absent from Apple's current REQUIRED list, which is why it was left out at first, but
         mandatory in practice: Spotify mails the 8-digit claim code to itunes:email and there is
         no other way to prove ownership of a self-hosted feed. Leaving it out passes every
         validator and then fails the submission with a message that does not say why. -->
    <itunes:owner>
      <itunes:name>${esc(AUTHOR)}</itunes:name>
      <itunes:email>${esc(OWNER_EMAIL)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${ARTWORK}" />
    <itunes:category text="${CATEGORY}" />
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <atom:link href="${SITE}${loc.path}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${rfc2822(newest)}</lastBuildDate>
    <!-- The show's identity, independent of this URL: it survives a move to another host, and
         it is how the directories tell this feed apart from a copy of it. -->
    <podcast:guid>${loc.guid}</podcast:guid>
    <!-- "yes" means no hosting platform may import this feed without the owner's consent. Flip
         to "no" only for the duration of a deliberate migration. -->
    <podcast:locked owner="${OWNER_EMAIL}">yes</podcast:locked>
    <!-- The narration is synthetic. Declaring it is Esteban's editorial stance and matches the
         disclosure shown on every page and by Larry; podcast:txt purpose="ai-content" is the
         emerging machine-readable signal for it. -->
    <podcast:txt purpose="ai-content">true</podcast:txt>
${items}
  </channel>
</rss>
`;

  return { xml, lastModified: new Date(rfc2822(newest)) };
}

// Conditional-GET and Range plumbing for the two feed routes.
//
// Apple, Spotify and every aggregator poll these feeds on a schedule forever; answering 304 when
// nothing changed is the difference between a D1 query per poll and a header comparison. Byte
// ranges are here because Apple's requirement is on episode media (which /media/video already
// serves as 206) but the validators run the same probe against the feed URL they were handed,
// and a 19 KB string we already hold in memory can satisfy it for free.
export function feedResponse(feed: BuiltFeed, request: Request): Response {
  const bytes = new TextEncoder().encode(feed.xml);
  // Length + a hash-free digest of the content is enough: the body is deterministic given the
  // data, so identical content always yields an identical tag.
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619);
  }
  const etag = `"${bytes.length.toString(16)}-${(h >>> 0).toString(16)}"`;
  const lastModified = feed.lastModified.toUTCString();

  const headers: Record<string, string> = {
    "content-type": "application/rss+xml; charset=utf-8",
    // Podcast clients poll often; an hour keeps them from hammering D1 while staying fresh
    // enough that a new episode shows up the same day.
    "cache-control": "public, max-age=3600",
    "accept-ranges": "bytes",
    etag,
    "last-modified": lastModified,
  };

  const inm = request.headers.get("if-none-match");
  if (inm && inm.split(",").some((t) => t.trim() === etag)) {
    return new Response(null, { status: 304, headers });
  }

  const range = request.headers.get("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (m && (m[1] || m[2])) {
    const size = bytes.length;
    let start: number;
    let end: number;
    if (m[1]) {
      start = parseInt(m[1], 10);
      end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
    } else {
      start = Math.max(0, size - parseInt(m[2], 10));
      end = size - 1;
    }
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
    }
    return new Response(bytes.slice(start, end + 1), {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}` },
    });
  }

  return new Response(bytes, { headers });
}

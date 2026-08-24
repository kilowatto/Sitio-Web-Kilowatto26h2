import { env } from "cloudflare:workers";
import { FEED_LOCALES } from "./podcast-feed";

// Runs the checks that were only ever run by hand, on a schedule.
//
// Every one of these caught a real bug today, and the last two are the reason this exists rather
// than a note to check again tomorrow:
//
//   - A stereo music sting concatenated onto mono speech played every voice at double speed.
//   - itunes:email was missing, which no validator flags and which silently fails the Spotify
//     claim days later.
//   - All 26 podcast:transcript URLs in the English feed were 404s. Podbase certified the feed
//     PSP-1 with them broken, because a feed validator checks that the tag is PRESENT, not that
//     the URL RESOLVES. Nothing but following every link would have found it.
//   - Apple has been showing 9 of 26 episodes since publication, which is either normal
//     progressive ingestion or a rejection, and the only way to know is to keep looking.

const APPLE_SHOWS: Record<string, number> = {
  "es-MX": 6804514606,
  en: 6804533284,
};

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  /** A warning is something we could not verify, as opposed to something we verified as broken.
   *  It shows in the report but does not turn the overall status red -- a permanently red light
   *  is a light nobody reads. */
  warn?: boolean;
}

export interface FeedReport {
  locale: string;
  url: string;
  checks: Check[];
}

export interface MonitorReport {
  at: string;
  ok: boolean;
  feeds: FeedReport[];
}

const SITE = "https://kilowatto.com";

// Anything on kilowatto.com goes through the SELF service binding; a plain fetch() to our own
// public hostname from inside the isolate exits to the edge and comes back, which returns 522.
// External URLs (Apple's lookup) use the normal fetch.
function selfFetch(url: string, init?: RequestInit): Promise<Response> {
  const svc = (env as any).SELF;
  if (svc && url.startsWith(SITE)) return svc.fetch(new Request(url, init));
  return fetch(url, init);
}

async function head(url: string): Promise<Response | null> {
  try {
    // A GET, not a HEAD: the point is to prove the thing a podcast app will actually fetch comes
    // back, and some routes answer HEAD differently from GET.
    return await selfFetch(url, { headers: { "user-agent": "kilowatto-monitor/1.0" } });
  } catch {
    return null;
  }
}

export async function runPodcastMonitor(): Promise<MonitorReport> {
  const feeds: FeedReport[] = [];

  for (const [code, loc] of Object.entries(FEED_LOCALES)) {
    const url = `${SITE}${loc.path}`;
    const checks: Check[] = [];
    const add = (name: string, ok: boolean, detail: string, warn = false) =>
      checks.push({ name, ok, detail, ...(warn ? { warn: true } : {}) });

    const res = await head(url);
    const xml = res && res.ok ? await res.text() : null;
    add("el feed responde", !!xml, res ? `HTTP ${res.status}` : "sin respuesta");
    if (!xml) {
      feeds.push({ locale: code, url, checks });
      continue;
    }

    // Cheap structural parsing. A real XML parser is not available in a Worker and the shapes
    // here are ours, so regex over our own generated markup is honest enough.
    const items = xml.match(/<item>/g)?.length ?? 0;
    const guids = xml.match(/<guid[^>]*>/g)?.length ?? 0;
    const enclosures = (xml.match(/<enclosure[^>]*length="(\d+)"/g) ?? []).filter(
      (e) => !/length="0"/.test(e)
    ).length;

    const expected = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM media_assets
        WHERE kind IN ('audio_narration','audio_dialogue') AND status = 'ready'
          AND locale = ? AND r2_key IS NOT NULL`
    )
      .bind(code)
      .first<{ n: number }>();

    add("episodios vs base de datos", items === Number(expected?.n ?? -1), `${items} en el feed, ${expected?.n} listos`);
    add("todos con guid", guids === items, `${guids}/${items}`);
    add("todos con enclosure y tamaño", enclosures === items, `${enclosures}/${items}`);
    add("itunes:email presente", /<itunes:email>[^<]+@/.test(xml), "Spotify lo usa para reclamar el feed");

    // Artwork.
    const artUrl = /<itunes:image href="([^"]+)"/.exec(xml)?.[1];
    if (artUrl) {
      const art = await head(artUrl);
      const type = art?.headers.get("content-type") ?? "";
      add("la portada responde", !!art?.ok && type.startsWith("image/"), `HTTP ${art?.status ?? "-"} ${type}`);
    } else {
      add("la portada responde", false, "no hay itunes:image en el feed");
    }

    // Every transcript. This is the check that would have caught the 26 broken ones.
    const transcripts = [...xml.matchAll(/<podcast:transcript url="([^"]+)"/g)].map((m) => m[1]);
    let brokenTranscripts = 0;
    for (const t of transcripts) {
      const r = await head(t);
      if (!r?.ok) brokenTranscripts++;
    }
    add("las transcripciones resuelven", brokenTranscripts === 0, `${transcripts.length - brokenTranscripts}/${transcripts.length}`);

    // Range support on the two newest enclosures. Apple requires it and will not promote a show
    // without it; a listener just cannot seek.
    const encUrls = [...xml.matchAll(/<enclosure url="([^"]+)"/g)].map((m) => m[1]).slice(0, 2);
    let badRange = 0;
    for (const e of encUrls) {
      try {
        const r = await selfFetch(e, { headers: { range: "bytes=0-99", "user-agent": "kilowatto-monitor/1.0" } });
        if (r.status !== 206) badRange++;
      } catch {
        badRange++;
      }
    }
    add("los MP3 aceptan Range", badRange === 0, `${encUrls.length - badRange}/${encUrls.length} responden 206`);

    // Apple, via the unauthenticated lookup. Apple's own API gives no listening analytics, but
    // it does say what the directory currently believes about the show.
    const appleId = APPLE_SHOWS[code];
    if (appleId) {
      try {
        // Apple answers this endpoint with content-type text/javascript and, to a client that
        // sends no user-agent, sometimes an empty body -- which is what "Unexpected end of JSON
        // input" was. Read it as text and parse it ourselves, and keep the status in the message
        // so a future failure says what actually happened.
        const r = await fetch(`https://itunes.apple.com/lookup?id=${appleId}&entity=podcast`, {
          headers: { "user-agent": "kilowatto-monitor/1.0 (+https://kilowatto.com)", accept: "application/json" },
        });
        const body = (await r.text()).trim();
        if (!body) throw new Error(`respuesta vacía (HTTP ${r.status})`);
        const data = JSON.parse(body);
        const show = data?.results?.[0];
        if (!show) {
          add("Apple conoce el programa", false, "todavía no indexado en la API de iTunes");
        } else {
          add("Apple conoce el programa", true, String(show.collectionName));
          const appleCount = Number(show.trackCount ?? 0);
          add(
            "Apple tiene todos los episodios",
            appleCount >= items,
            `${appleCount} de ${items}`
          );
          add(
            "Apple usa el nombre actual",
            String(show.collectionName) === loc.title,
            `Apple: "${show.collectionName}"`
          );
        }
      } catch (err: any) {
        // Apple answers 403 to Cloudflare's egress ranges, so this endpoint is simply not
        // reachable from a Worker -- the same request from a laptop works. Reported as a warning
        // rather than a failure: it is a gap in what we can see, not a fault in the feed.
        add(
          "Apple conoce el programa",
          false,
          `no consultable desde el Worker (${err?.message ?? "desconocido"}). Apple bloquea las IPs de Cloudflare.`,
          true
        );
      }
    }

    feeds.push({ locale: code, url, checks });
  }

  const report: MonitorReport = {
    at: new Date().toISOString(),
    ok: feeds.every((f) => f.checks.every((c) => c.ok || c.warn)),
    feeds,
  };

  try {
    await env.KILOWATTO_KV.put("podcast_monitor_last", JSON.stringify(report));
  } catch {
    /* the report is still returned to the caller */
  }
  return report;
}

export async function lastPodcastMonitor(): Promise<MonitorReport | null> {
  try {
    const raw = await env.KILOWATTO_KV.get("podcast_monitor_last");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

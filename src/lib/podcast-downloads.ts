import { queryPageViews } from "./cf-analytics";

// Reads podcast downloads out of kilowatto_podcast_downloads.
//
// The counting rule is the whole point. One listen produces dozens of partial HTTP requests, so
// counting requests inflates the number by an order of magnitude and counting unique listeners
// undercounts a person who listens twice. The IAB standard resolves it the same way this does:
// group a listener's requests for one episode within one day, require that they pulled at least
// a minute of audio, and call that one download.
//
// At 192 kbps CBR a minute is 1,440,000 bytes. An app that fetches the first few seconds to read
// the ID3 tags and stops -- which every directory does on every poll -- lands far below it and
// is not counted, which is exactly the intent.
const MIN_BYTES = 1_440_000;

// Every function returns null on failure rather than throwing: reads need a separate API token
// from the write binding, and that token expiring should not take a dashboard down.

export interface DownloadTotals {
  downloads: number;
  gigabytes: number;
  requests: number;
}

export async function getDownloadTotals(days = 30): Promise<DownloadTotals | null> {
  try {
    const res = await queryPageViews(
      `SELECT COUNT() AS downloads, SUM(bytes) AS bytes, SUM(reqs) AS requests FROM (
         SELECT blob7 AS listener, blob1 AS et, blob2 AS eid, toDate(timestamp) AS day,
                SUM(double1) AS bytes, COUNT() AS reqs
         FROM kilowatto_podcast_downloads
         WHERE timestamp > NOW() - INTERVAL '${days}' DAY AND blob5 != 'bot'
         GROUP BY listener, et, eid, day
         HAVING bytes >= ${MIN_BYTES}
       )`
    );
    const row: any = res.data?.[0];
    if (!row) return null;
    return {
      downloads: Number(row.downloads ?? 0),
      gigabytes: Number(((Number(row.bytes ?? 0)) / 1e9).toFixed(2)),
      requests: Number(row.requests ?? 0),
    };
  } catch {
    return null;
  }
}

export interface DownloadsByClient {
  client: string;
  downloads: number;
}

export async function getDownloadsByClient(days = 30): Promise<DownloadsByClient[] | null> {
  try {
    const res = await queryPageViews(
      `SELECT client, COUNT() AS downloads FROM (
         SELECT blob5 AS client, blob7 AS listener, blob1 AS et, blob2 AS eid,
                toDate(timestamp) AS day, SUM(double1) AS bytes
         FROM kilowatto_podcast_downloads
         WHERE timestamp > NOW() - INTERVAL '${days}' DAY
         GROUP BY client, listener, et, eid, day
         HAVING bytes >= ${MIN_BYTES}
       )
       GROUP BY client ORDER BY downloads DESC`
    );
    return (res.data ?? []).map((r: any) => ({ client: String(r.client), downloads: Number(r.downloads) }));
  } catch {
    return null;
  }
}

export interface DownloadsByEpisode {
  entityType: string;
  entityId: number;
  kind: string;
  locale: string;
  downloads: number;
}

export async function getDownloadsByEpisode(days = 30, limit = 30): Promise<DownloadsByEpisode[] | null> {
  try {
    const res = await queryPageViews(
      `SELECT et, eid, kind, locale, COUNT() AS downloads FROM (
         SELECT blob1 AS et, blob2 AS eid, blob4 AS kind, blob3 AS locale, blob7 AS listener,
                toDate(timestamp) AS day, SUM(double1) AS bytes
         FROM kilowatto_podcast_downloads
         WHERE timestamp > NOW() - INTERVAL '${days}' DAY AND blob5 != 'bot'
         GROUP BY et, eid, kind, locale, listener, day
         HAVING bytes >= ${MIN_BYTES}
       )
       GROUP BY et, eid, kind, locale ORDER BY downloads DESC LIMIT ${limit}`
    );
    return (res.data ?? []).map((r: any) => ({
      entityType: String(r.et),
      entityId: Number(r.eid),
      kind: String(r.kind),
      locale: String(r.locale),
      downloads: Number(r.downloads),
    }));
  } catch {
    return null;
  }
}

export interface DownloadsByCountry {
  country: string;
  downloads: number;
}

export async function getDownloadsByCountry(days = 30, limit = 12): Promise<DownloadsByCountry[] | null> {
  try {
    const res = await queryPageViews(
      `SELECT country, COUNT() AS downloads FROM (
         SELECT blob6 AS country, blob7 AS listener, blob1 AS et, blob2 AS eid,
                toDate(timestamp) AS day, SUM(double1) AS bytes
         FROM kilowatto_podcast_downloads
         WHERE timestamp > NOW() - INTERVAL '${days}' DAY AND blob5 != 'bot' AND blob6 != ''
         GROUP BY country, listener, et, eid, day
         HAVING bytes >= ${MIN_BYTES}
       )
       GROUP BY country ORDER BY downloads DESC LIMIT ${limit}`
    );
    return (res.data ?? []).map((r: any) => ({ country: String(r.country), downloads: Number(r.downloads) }));
  } catch {
    return null;
  }
}

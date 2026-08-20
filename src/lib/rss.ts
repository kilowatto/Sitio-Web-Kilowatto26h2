export interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const m of itemMatches) {
    const block = m[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "") ?? "";
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "") ?? "";
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
    const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "") ?? "";
    if (title && link) items.push({ title, link, pubDate, source });
  }
  return items;
}

export async function fetchGoogleNewsRss(query: string, hl = "es-419", gl = "MX"): Promise<RssItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; kilowatto-news-bot/1.0)" } });
  const xml = await res.text();
  return parseRssItems(xml);
}

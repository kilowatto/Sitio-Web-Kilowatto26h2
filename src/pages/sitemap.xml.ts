import type { APIRoute } from "astro";
import { LOCALES } from "../lib/locales";

export const prerender = false;

const PAGES = ["", "trayectoria", "empresas", "inversiones", "yucatech", "prensa", "familia", "galeria"];

function pathFor(locale: (typeof LOCALES)[number], page: string) {
  const prefix = locale.canonical ? "" : `/${locale.code}`;
  return page ? `${prefix}/${page}` : prefix || "/";
}

export const GET: APIRoute = () => {
  const urls: string[] = [];

  for (const page of PAGES) {
    for (const locale of LOCALES) {
      const loc = `https://kilowatto.com${pathFor(locale, page)}`;
      const alternates = LOCALES.map(
        (l) => `<xhtml:link rel="alternate" hreflang="${l.code}" href="https://kilowatto.com${pathFor(l, page)}" />`
      ).join("");
      urls.push(`  <url><loc>${loc}</loc>${alternates}</url>`);
    }
  }

  urls.push(`  <url><loc>https://kilowatto.com/stack</loc></url>`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;

  return new Response(xml, { headers: { "content-type": "application/xml" } });
};

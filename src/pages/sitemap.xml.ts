import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { LOCALES } from "../lib/locales";
import { BOOKS_PAGE_SIZE } from "../lib/books-query";
import { COLUMNS_PAGE_SIZE } from "../lib/columns-query";

export const prerender = false;

const PAGES = ["", "trayectoria", "empresas", "inversiones", "yucatech", "prensa", "columnas", "curiosidades", "avestruces", "comida", "galeria", "contacto", "podcast"];
const PRESS_PAGE_SIZE = 12;

// Static pages have no CMS "updated_at" — bump the date here when a page's content
// meaningfully changes. Falls back to FALLBACK_LASTMOD for anything not listed.
const FALLBACK_LASTMOD = "2026-07-19";
const PAGE_LASTMOD: Record<string, string> = {
  "": "2026-07-25",
  trayectoria: "2026-07-26",
  empresas: "2026-07-26",
  yucatech: "2026-07-26",
  prensa: "2026-07-26",
  curiosidades: "2026-07-26",
  avestruces: "2026-07-27",
  comida: "2026-07-26",
  galeria: "2026-07-26",
  contacto: "2026-07-24",
  stack: "2026-07-19",
  "prensa/kit": "2026-07-25",
  biblioteca: "2026-07-26",
  columnas: "2026-07-27",
};

function pathFor(locale: (typeof LOCALES)[number], page: string) {
  const prefix = locale.canonical ? "" : `/${locale.code}`;
  return page ? `${prefix}/${page}` : prefix || "/";
}

export const GET: APIRoute = async () => {
  const urls: string[] = [];

  for (const page of PAGES) {
    const lastmod = PAGE_LASTMOD[page] ?? FALLBACK_LASTMOD;
    for (const locale of LOCALES) {
      const loc = `https://kilowatto.com${pathFor(locale, page)}`;
      const alternates = LOCALES.map(
        (l) => `<xhtml:link rel="alternate" hreflang="${l.code}" href="https://kilowatto.com${pathFor(l, page)}" />`
      ).join("");
      urls.push(`  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod>${alternates}</url>`);
    }
  }

  urls.push(`  <url><loc>https://kilowatto.com/stack</loc><lastmod>${PAGE_LASTMOD.stack}</lastmod></url>`);
  urls.push(`  <url><loc>https://kilowatto.com/biblioteca</loc><lastmod>${PAGE_LASTMOD.biblioteca}</lastmod></url>`);
  urls.push(`  <url><loc>https://kilowatto.com/prensa/kit</loc><lastmod>${PAGE_LASTMOD["prensa/kit"]}</lastmod></url>`);

  // Extra /prensa pages beyond page 1 (already listed above) — real, self-canonical pages,
  // not just infinite-scroll fragments, so they belong in the sitemap like any other page.
  // lastmod here is real (max published_at per page), not a hardcoded guess like the static pages above.
  if (env?.DB) {
    const countRes = await env.DB.prepare("SELECT COUNT(*) AS n FROM press_mentions WHERE status = 'published'").first<any>();
    const totalPages = Math.max(1, Math.ceil((countRes?.n ?? 0) / PRESS_PAGE_SIZE));
    for (let p = 2; p <= totalPages; p++) {
      const offset = (p - 1) * PRESS_PAGE_SIZE;
      const pageLastmodRes = await env.DB.prepare(
        "SELECT published_at FROM press_mentions WHERE status = 'published' ORDER BY published_at DESC LIMIT 1 OFFSET ?"
      )
        .bind(offset)
        .first<any>();
      const pageLastmod = pageLastmodRes?.published_at ? String(pageLastmodRes.published_at).slice(0, 10) : FALLBACK_LASTMOD;
      urls.push(`  <url><loc>https://kilowatto.com/prensa/${p}</loc><lastmod>${pageLastmod}</lastmod></url>`);
    }

    // Extra /biblioteca pages beyond page 1 — same reasoning as /prensa above.
    const bookCountRes = await env.DB.prepare("SELECT COUNT(*) AS n FROM books").first<any>();
    const bookTotalPages = Math.max(1, Math.ceil((bookCountRes?.n ?? 0) / BOOKS_PAGE_SIZE));
    for (let p = 2; p <= bookTotalPages; p++) {
      urls.push(`  <url><loc>https://kilowatto.com/biblioteca/${p}</loc><lastmod>${PAGE_LASTMOD.biblioteca}</lastmod></url>`);
    }

    // Extra /columnas listing pages beyond page 1, and each article's own page — translated
    // to every locale (unlike /biblioteca, columnas isn't Spanish-only), so both loops run
    // per-locale rather than emitting one canonical-only URL.
    const columnCountRes = await env.DB.prepare("SELECT COUNT(*) AS n FROM columns WHERE status = 'published'").first<any>();
    const columnTotalPages = Math.max(1, Math.ceil((columnCountRes?.n ?? 0) / COLUMNS_PAGE_SIZE));
    const columnRows = await env.DB.prepare("SELECT slug, published_at FROM columns WHERE status = 'published'").all<any>();
    for (const locale of LOCALES) {
      const prefix = locale.canonical ? "" : `/${locale.code}`;
      for (let p = 2; p <= columnTotalPages; p++) {
        urls.push(`  <url><loc>https://kilowatto.com${prefix}/columnas/${p}</loc><lastmod>${PAGE_LASTMOD.columnas}</lastmod></url>`);
      }
      for (const c of columnRows?.results ?? []) {
        const lastmod = c.published_at ? String(c.published_at).slice(0, 10) : PAGE_LASTMOD.columnas;
        urls.push(`  <url><loc>https://kilowatto.com${prefix}/columnas/${c.slug}</loc><lastmod>${lastmod}</lastmod></url>`);
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;

  return new Response(xml, { headers: { "content-type": "application/xml" } });
};

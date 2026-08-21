import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const MOBILE_RE = /Mobi|Android|iPhone|iPad|iPod/i;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Public redirect for short links cited in posts (kilowatto.com/r/xxxx) -- logs a click with
// every server-side-available detail (Esteban, 2026-08-21: "maxima informacion... ip,
// navegador, si es movil, dimensiones, resolucion... incluido hora y fecha"), then serves a
// near-instant interstitial that reports screen/viewport (only available client-side) before
// bouncing to the real URL. Never blocks the redirect on any of this succeeding.
export const GET: APIRoute = async ({ params, request }) => {
  const slug = params.slug;
  const row = await env.DB.prepare("SELECT id, target_url FROM short_links WHERE slug = ?").bind(slug).first<any>();
  if (!row) return new Response("not found", { status: 404 });

  env.DB.prepare("UPDATE short_links SET clicks = clicks + 1 WHERE slug = ?")
    .bind(slug)
    .run()
    .catch((err) => console.error("short link click increment failed:", err));

  const cf: any = (request as any).cf ?? {};
  const ua = request.headers.get("user-agent") ?? "";
  const ip = request.headers.get("cf-connecting-ip") ?? null;
  const referrer = request.headers.get("referer") ?? null;
  const acceptLanguage = request.headers.get("accept-language")?.split(",")[0]?.trim() ?? null;

  let clickId: number | null = null;
  try {
    const res = await env.DB.prepare(
      `INSERT INTO link_clicks (short_link_id, ip, country, city, region, timezone, colo, asn, as_organization, user_agent, is_mobile, referrer, language)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        row.id,
        ip,
        cf.country ?? null,
        cf.city ?? null,
        cf.region ?? null,
        cf.timezone ?? null,
        cf.colo ?? null,
        cf.asn ?? null,
        cf.asOrganization ?? null,
        ua,
        MOBILE_RE.test(ua) ? 1 : 0,
        referrer,
        acceptLanguage
      )
      .run();
    clickId = Number(res.meta.last_row_id);
  } catch (err) {
    console.error("link_clicks insert failed:", err);
  }

  const target = row.target_url as string;
  const safeTarget = escapeHtml(target);

  // clickId is null if the insert above failed -- the client beacon just no-ops in that case
  // (nothing to attach screen/viewport data to), the redirect still happens either way.
  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<title>Redirigiendo...</title></head>
<body>
<script>
(function() {
  var clickId = ${clickId === null ? "null" : clickId};
  var target = ${JSON.stringify(target)};
  function go() { window.location.replace(target); }
  if (clickId === null) { go(); return; }
  var done = false;
  function finish() { if (done) return; done = true; go(); }
  setTimeout(finish, 250);
  fetch("/api/track-click-client", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: clickId,
      screenWidth: window.screen ? window.screen.width : null,
      screenHeight: window.screen ? window.screen.height : null,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1
    })
  }).catch(function() {}).finally(finish);
})();
</script>
<noscript><meta http-equiv="refresh" content="0;url=${safeTarget}"></noscript>
</body></html>`;

  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
};

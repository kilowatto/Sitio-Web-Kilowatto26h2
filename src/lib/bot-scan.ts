// This site runs on Astro/Cloudflare Workers -- it has zero legitimate routes matching
// any of these. They're WordPress/generic vulnerability-scanner probes (wp-login.php,
// .env, .git/config, xmlrpc.php, random *.php files, ...) that flood the broken_links
// admin report with bot noise indistinguishable from real dead links. Esteban's call
// (2026-08-21): serve them a joke page and a real 200, not a tracked 404.
export const BOT_SCAN_RE =
  /\.php\/?$|^\/wp-|\/wp-content\/|\/wp-admin\/|\/wp-json\/|^\/\.env\/?$|^\/\.git\/|^\/\.aws\/|^\/\.ssh\/|\/phpmyadmin|^\/cgi-bin\//i;

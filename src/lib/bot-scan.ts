// This site runs on Astro/Cloudflare Workers -- it has zero legitimate routes matching
// any of these. They're WordPress/generic vulnerability-scanner probes (wp-login.php,
// .env, .git/config, xmlrpc.php, random *.php files, ...) that flood the broken_links
// admin report with bot noise indistinguishable from real dead links. Esteban's call
// (2026-08-21): serve them a joke page and a real 200, not a tracked 404.
// .env probes get their own honeypot (a fake leaked-secrets page, see src/pages/fake-env.astro)
// instead of the generic joke -- checked separately, and BEFORE BOT_SCAN_RE, in both
// [...slug].astro and [locale]/index.astro.
export const ENV_SCAN_RE = /\.env(\.[\w-]+)*\/?$/i;

export const BOT_SCAN_RE =
  /\.php\/?$|^\/wp-|\/wp-content\/|\/wp-admin\/|\/wp-json\/|\/\.git\/|\/\.aws\/|\/\.ssh\/|\/phpmyadmin|\/cgi-bin\/|^\/(bin|lib|usr|src|dev|inc|s3|app|my|pms|ecp|env|git|php)\/?$/i;

// Broken_links also fills up with bots enumerating ISO language codes this site doesn't
// serve (/pl/, /th/, a bare /es/ when the real routes are es-MX/es-AR/...) -- checked
// AFTER a real locale match fails, so "en"/"fr"/"de"/"ar"/"ja" (genuinely supported) never
// reach this. Deliberately narrow (2 letters only) so it can't shadow a future real page.
export const LOCALE_GUESS_RE = /^[a-z]{2}$/i;

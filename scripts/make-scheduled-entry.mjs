// Post-build step: @astrojs/cloudflare's generated entry.mjs only exports `fetch`.
// Cloudflare Cron Triggers need a `scheduled` export on the same Worker, so we wrap the
// generated entry with a small shim that adds one, calling our own /api/news/check
// endpoint internally on each fire.
import fs from "node:fs";
import path from "node:path";

const serverDir = path.resolve("dist/server");
const wrapperPath = path.join(serverDir, "scheduled-entry.mjs");
const configPath = path.join(serverDir, "wrangler.json");

// Copy the hand-written Workflow class alongside the generated entry so the wrapper below can
// import it as a plain relative module -- it can't be authored as a .ts file under src/ since
// nothing in the Astro/Vite build would ever compile or bundle it into dist/server on its own.
fs.copyFileSync(path.resolve("scripts/translate-investigacion-workflow.mjs"), path.join(serverDir, "translate-investigacion-workflow.mjs"));
fs.copyFileSync(path.resolve("scripts/translate-column-workflow.mjs"), path.join(serverDir, "translate-column-workflow.mjs"));

fs.writeFileSync(
  wrapperPath,
  `import astroHandler from "./entry.mjs";
export { TranslateInvestigacionWorkflow } from "./translate-investigacion-workflow.mjs";
export { TranslateColumnWorkflow } from "./translate-column-workflow.mjs";

// Calls the Worker's OWN exported fetch handler directly (a plain in-isolate function call),
// NOT a real network fetch() to the public hostname. The old version did
// fetch("https://kilowatto.com/api/...") from inside the scheduled handler — a real round trip
// back out through Cloudflare's edge into the same Worker. Confirmed live 2026-07-27: every
// single */30 brand/tick fire failed with "error code: 522" (edge timeout) once the full tick
// (multiple LLM calls + Gemini image generation) ran long enough — zero auto-generated posts
// for days despite the cron firing exactly on schedule. tick.ts's own internal hops were already
// converted to direct in-process calls for this same reason (see its top comment); this was the
// one remaining network hop, one level up, and it's now gone the same way.
function callSelf(path, env, ctx) {
  // Astro's default CSRF guard (security.checkOrigin) rejects any POST whose Origin header is
  // missing or mismatched, treating "no Origin" the same as "wrong origin" — confirmed live
  // 2026-07-27: this in-process call has no Origin by default (unlike a real browser/edge
  // request) and got "Cross-site POST form submissions are forbidden" until this header was
  // added to match the request's own host.
  const req = new Request("https://kilowatto.com" + path, { method: "POST", headers: { origin: "https://kilowatto.com" } });
  return astroHandler.fetch(req, env, ctx).then((r) => r.text());
}

export default {
  fetch: astroHandler.fetch,
  async scheduled(controller, env, ctx) {
    if (controller.cron === "0 */6 * * *") {
      ctx.waitUntil(
        (async () => {
          // A manual "Buscar menciones nuevas ahora" click already covers this cron's own
          // job — skip if the last real check (manual or scheduled) ran under 6h ago instead
          // of unconditionally re-firing on the fixed Cron Trigger schedule.
          const lastRun = await env.KILOWATTO_KV.get("last_news_check_at");
          if (lastRun && Date.now() - new Date(lastRun).getTime() < 6 * 60 * 60 * 1000) {
            console.log("Skipping scheduled news check — last run was", lastRun);
            return;
          }
          const t = await callSelf("/api/news/check?token=" + env.ADMIN_TOKEN, env, ctx);
          console.log("Scheduled news check:", t);
        })().catch((e) => console.error("Scheduled news check failed:", e))
      );
    } else if (controller.cron === "30 */6 * * *") {
      // Generates whatever audio is missing, two assets at a time. Deliberately NOT hooked into
      // approve.ts: generating takes minutes, and the English audio cannot start until the
      // English translation workflow that the same approve fired has finished. A sweep finds
      // the work later, when it is actually ready, and retries itself if a pass fails.
      ctx.waitUntil(
        callSelf("/api/admin/audio-sweep?token=" + env.ADMIN_TOKEN, env, ctx)
          .then((t) => console.log("Scheduled audio sweep:", t))
          .catch((e) => console.error("Scheduled audio sweep failed:", e))
      );
      // Same fire: vincular los posts que no tienen enlace propio, y decidir si toca invitar al
      // podcast. Los dos existían desde el sprint y ninguno estaba en un cron -- relate-posts
      // solo lo llamaba un endpoint de admin, y subscription_cta tiene exactamente UN post en
      // toda su historia, hecho a mano. La regla de "pico de descargas o cada doce posts" estaba
      // escrita y nunca se evaluaba.
      ctx.waitUntil(
        callSelf("/api/admin/relate-posts?token=" + env.ADMIN_TOKEN, env, ctx)
          .then((t) => console.log("Scheduled relate-posts:", t))
          .catch((e) => console.error("Scheduled relate-posts failed:", e))
      );
      ctx.waitUntil(
        callSelf("/api/admin/subscription-cta?token=" + env.ADMIN_TOKEN, env, ctx)
          .then((t) => console.log("Scheduled subscription CTA:", t))
          .catch((e) => console.error("Scheduled subscription CTA failed:", e))
      );
      // Same fire, third job: one clip, at most. The cadence limit (five a week) lives in the
      // sweeper, and it does nothing at all until the render service is deployed -- so this can
      // be wired now and simply starts working the day the container image exists.
      ctx.waitUntil(
        callSelf("/api/admin/clip-sweep?token=" + env.ADMIN_TOKEN, env, ctx)
          .then((t) => console.log("Scheduled clip sweep:", t))
          .catch((e) => console.error("Scheduled clip sweep failed:", e))
      );
      // Same fire, second job: verify the feeds and what the directories believe about them.
      // Cheap (a few dozen HEAD-ish requests) and it is the only thing that notices when a
      // transcript URL starts 404-ing or Apple silently stops ingesting episodes.
      ctx.waitUntil(
        callSelf("/api/admin/podcast-check?token=" + env.ADMIN_TOKEN, env, ctx)
          .then((t) => console.log("Scheduled podcast check:", t))
          .catch((e) => console.error("Scheduled podcast check failed:", e))
      );
    } else if (controller.cron === "0 8 * * 1") {
      ctx.waitUntil(
        callSelf("/api/projects/refresh?token=" + env.ADMIN_TOKEN, env, ctx)
          .then((t) => console.log("Scheduled projects refresh:", t))
          .catch((e) => console.error("Scheduled projects refresh failed:", e))
      );
    } else if (controller.cron === "0 9 * * 1") {
      ctx.waitUntil(
        callSelf("/api/press/web-search?token=" + env.ADMIN_TOKEN, env, ctx)
          .then((t) => console.log("Scheduled press web search:", t))
          .catch((e) => console.error("Scheduled press web search failed:", e))
      );
    } else if (controller.cron === "0 10 * * 1") {
      ctx.waitUntil(
        callSelf("/api/press/weekly-briefing?token=" + env.ADMIN_TOKEN, env, ctx)
          .then((t) => console.log("Scheduled weekly briefing:", t))
          .catch((e) => console.error("Scheduled weekly briefing failed:", e))
      );
    } else if (controller.cron === "0 11 * * 1") {
      ctx.waitUntil(
        callSelf("/api/columns/generate?token=" + env.ADMIN_TOKEN, env, ctx)
          .then((t) => console.log("Scheduled column draft:", t))
          .catch((e) => console.error("Scheduled column draft failed:", e))
      );
    } else {
      ctx.waitUntil(
        callSelf("/api/brand/tick?token=" + env.ADMIN_TOKEN, env, ctx)
          .then((t) => console.log("Scheduled brand tick:", t))
          .catch((e) => console.error("Scheduled brand tick failed:", e))
      );
    }
  },
};
`
);

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
config.main = "scheduled-entry.mjs";
config.workflows = [
  { name: "translate-investigacion", binding: "TRANSLATE_INVESTIGACION_WORKFLOW", class_name: "TranslateInvestigacionWorkflow" },
  { name: "translate-column", binding: "TRANSLATE_COLUMN_WORKFLOW", class_name: "TranslateColumnWorkflow" },
];
// Weekly (Monday 08:00 UTC): re-fetch each of Esteban's live projects, refresh their
// summary from the real page content, and auto-hide/show them based on reachability.
// Weekly (Monday 09:00 UTC, offset an hour from the projects refresh so they don't overlap):
// broad Brave Search API sweep for historical/older press the 6-hourly Google News RSS cron
// can't reach — kept weekly (not 6-hourly like news/check) to respect Brave's free-tier quota.
// Weekly (Monday 10:00 UTC, offset an hour from the press web-search cron): Esteban's own
// broader monitoring list — his companies/investments/side businesses (Ignia Cloud, Finsus,
// restaurants, Orange Rhino, etc.) plus a small set of family names he confirmed must be treated
// as hard-private (see weekly-briefing.ts). Never auto-published — always lands as pending.
// Weekly (Monday 11:00 UTC, offset an hour from the weekly briefing): drafts ONE new long-form
// opinion column in Esteban's voice (see src/pages/api/columns/generate.ts) and always lands as
// 'pending_approval' — this is drafting, not publishing, so it runs regardless of the brand
// autopilot pause state; only a real approve click in /admin/columnas makes it public.
// A service binding pointing at THIS Worker. The podcast monitor has to fetch its own public
// URLs -- the whole point is proving that what a podcast app requests actually comes back -- and
// a plain fetch() to kilowatto.com from inside the isolate goes out to the edge and back in,
// which returns 522. Confirmed live 2026-08-23: both feed checks failed that way on the first
// run. A service binding is the supported loopback and never leaves Cloudflare's network.
//
// Declared here rather than in wrangler.jsonc for the same reason as the Workflow bindings: the
// service does not exist locally and declaring it there breaks `astro dev`.
// RENDER points at kilowatto-render (render-worker/), the separate Worker that owns the
// Remotion container. Remotion cannot run in an isolate at all -- it launches Chrome and a
// native binary -- so rendering lives in a container, and a container needs a Worker of its
// own. Keeping it out of this Worker means a bad image or a runaway render cannot take
// kilowatto.com with it.
// Guards the service binding to kilowatto-render: a binding to a Worker that does not exist can
// be rejected at deploy time, and that would block every deploy of the SITE over a feature the
// site does not depend on. Turned on 2026-08-24, when render-worker deployed for the first time.
const RENDER_SERVICE_DEPLOYED = true;

config.services = [
  { binding: "SELF", service: config.name },
  ...(RENDER_SERVICE_DEPLOYED ? [{ binding: "RENDER", service: "kilowatto-render" }] : []),
];

// Cloudflare Email Sending. Declared here rather than in wrangler.jsonc for the same reason as
// the Workflow and service bindings: it does not exist in local dev and breaks `astro dev`.
// The destination has to be a verified address in Email Routing -- larry@kilowatto.com forwards
// to Esteban's real inbox, which is what made this possible at all.
// The Email Sending beta shape: no destination_address allowlist, and `remote: true` so local
// dev talks to the real service instead of failing.
config.send_email = [{ name: "EMAIL", remote: true }];

config.triggers = { crons: ["0 */6 * * *", "30 */6 * * *", "*/30 6-23 * * *", "0 8 * * 1", "0 9 * * 1", "0 10 * * 1", "0 11 * * 1"] };
// Without this, Cloudflare's static-asset layer intercepts requests for paths that don't
// match a real file BEFORE the Worker ever runs, and falls back to its own redirect-to-"/"
// behavior — confirmed live 2026-07-22: any genuinely unmatched URL (and the custom
// src/pages/404.astro page built to handle it) never got a chance to run. Forcing every
// request through the Worker first lets Astro's own router serve the real 404 page/status.
if (config.assets) config.assets.run_worker_first = true;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log("Wrote scheduled-entry.mjs and updated wrangler.json with cron trigger.");

// Post-build step: @astrojs/cloudflare's generated entry.mjs only exports `fetch`.
// Cloudflare Cron Triggers need a `scheduled` export on the same Worker, so we wrap the
// generated entry with a small shim that adds one, calling our own /api/news/check
// endpoint internally on each fire.
import fs from "node:fs";
import path from "node:path";

const serverDir = path.resolve("dist/server");
const wrapperPath = path.join(serverDir, "scheduled-entry.mjs");
const configPath = path.join(serverDir, "wrangler.json");

fs.writeFileSync(
  wrapperPath,
  `import astroHandler from "./entry.mjs";

export default {
  fetch: astroHandler.fetch,
  async scheduled(controller, env, ctx) {
    if (controller.cron === "0 */6 * * *") {
      ctx.waitUntil(
        fetch("https://kilowatto.com/api/news/check?token=" + env.ADMIN_TOKEN, { method: "POST" })
          .then((r) => r.text())
          .then((t) => console.log("Scheduled news check:", t))
          .catch((e) => console.error("Scheduled news check failed:", e))
      );
    } else {
      ctx.waitUntil(
        fetch("https://kilowatto.com/api/brand/tick?token=" + env.ADMIN_TOKEN, { method: "POST" })
          .then((r) => r.text())
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
config.triggers = { crons: ["0 */6 * * *", "*/30 6-23 * * *"] };
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log("Wrote scheduled-entry.mjs and updated wrangler.json with cron trigger.");

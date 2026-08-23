// Cloudflare Workflow: translates one published column into all 11 non-canonical locales in
// the background. Triggered (best-effort, non-blocking) from
// src/pages/api/columns/[id]/approve.ts via env.TRANSLATE_COLUMN_WORKFLOW.create().
//
// Why this exists: investigaciones already auto-translated on approve, columns never did. Any
// column published between manual runs of /api/translate stayed missing from all 11 locales,
// and nothing surfaced it -- the gap was only found because the audio backfill tripped over a
// column with no English body (2026-08-22, "el-diseno-centrado-en-el-usuario-una-leccion-de-
// steve-jobs", published three weeks earlier). That is a recurring bug, not a one-off.
//
// Hand-written plain JS for the same reason as translate-investigacion-workflow.mjs: it is
// copied straight into dist/server/ by scripts/make-scheduled-entry.mjs rather than compiled
// by Astro/Vite, and it reuses the in-process fetch trick so 11 locales never make a real
// network round-trip back into the same Worker (which is what caused the 522 edge timeouts).
import { WorkflowEntrypoint } from "cloudflare:workers";
import astroHandler from "./entry.mjs";

const NON_CANONICAL_LOCALES = ["es-AR", "es-CO", "es-ES", "es-419", "en", "pt-BR", "fr", "de", "ar", "zh-Hans", "ja"];

// Astro's Cloudflare adapter calls context.waitUntil.bind(context) unconditionally; a Workflow
// step has no real ExecutionContext, so a callable stub has to exist or every step throws
// "Cannot read properties of undefined (reading 'bind')".
function fakeExecutionContext() {
  return { waitUntil() {}, passThroughOnException() {} };
}

function callSelf(path, env) {
  const req = new Request("https://kilowatto.com" + path, {
    method: "POST",
    headers: { origin: "https://kilowatto.com", "content-type": "application/json" },
    body: "{}",
  });
  return astroHandler.fetch(req, env, fakeExecutionContext()).then(async (r) => {
    const text = await r.text();
    if (!r.ok) throw new Error(`translate call failed (${r.status}): ${text.slice(0, 300)}`);
    return text;
  });
}

export class TranslateColumnWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const columnId = event.payload.columnId;

    for (const locale of NON_CANONICAL_LOCALES) {
      await step.do(
        `translate column ${locale}`,
        { retries: { limit: 3, delay: "30 seconds", backoff: "exponential" }, timeout: "10 minutes" },
        async () => {
          // columnId scopes this to the one piece: the endpoint's default is every column,
          // which would regenerate translations that published audio and its cue map are
          // already built against.
          const result = await callSelf(
            `/api/translate?token=${this.env.ADMIN_TOKEN}&locale=${locale}&columnId=${columnId}`,
            this.env
          );
          return { locale, result: result.slice(0, 120) };
        }
      );
    }

    return { columnId, locales: NON_CANONICAL_LOCALES.length };
  }
}

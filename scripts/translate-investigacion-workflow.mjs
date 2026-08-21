// Cloudflare Workflow: translates one published investigación into all 11 non-canonical
// locales in the background. Triggered (best-effort, non-blocking) from
// src/pages/api/investigaciones/[id]/approve.ts via env.TRANSLATE_INVESTIGACION_WORKFLOW.create().
//
// Hand-written plain JS (not compiled by Astro/Vite) because it's copied straight into
// dist/server/ by scripts/make-scheduled-entry.mjs and imported from the wrapped entry --
// same reasoning as that file's own scheduled-entry.mjs shim. It reuses the exact same
// "call the Worker's own fetch handler in-process" trick that file already established (see
// its comment on the 522/edge-timeout bug from calling out to the public hostname instead),
// so translating 11 locales never does a real network round-trip back into the same Worker.
import { WorkflowEntrypoint } from "cloudflare:workers";
import astroHandler from "./entry.mjs";

const NON_CANONICAL_LOCALES = ["es-AR", "es-CO", "es-ES", "es-419", "en", "pt-BR", "fr", "de", "ar", "zh-Hans", "ja"];

// Astro's Cloudflare adapter does `context.waitUntil.bind(context)` unconditionally on every
// request (see dist/server/entry.mjs) -- a Workflow step has no real ExecutionContext, so this
// stub just needs a callable `waitUntil`/`passThroughOnException` to exist. Nothing in this
// translate route path actually defers work through it (middleware.ts's own waitUntil'd page-
// view logging only fires for text/html responses, and this route returns JSON), so a no-op is
// enough -- confirmed live 2026-08-21: passing a bare `{}` here threw
// "Cannot read properties of undefined (reading 'bind')" on every single step.
function fakeExecutionContext() {
  return { waitUntil() {}, passThroughOnException() {} };
}

function callSelf(path, body, env) {
  const req = new Request("https://kilowatto.com" + path, {
    method: "POST",
    headers: { origin: "https://kilowatto.com", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return astroHandler.fetch(req, env, fakeExecutionContext()).then(async (r) => {
    const text = await r.text();
    if (!r.ok) throw new Error(`translate call failed (${r.status}): ${text.slice(0, 300)}`);
    return text;
  });
}

export class TranslateInvestigacionWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const investigacionId = event.payload.investigacionId;

    for (const locale of NON_CANONICAL_LOCALES) {
      await step.do(
        `translate ${locale}`,
        { retries: { limit: 3, delay: "30 seconds", backoff: "exponential" }, timeout: "10 minutes" },
        async () => {
          const result = await callSelf(
            `/api/investigaciones/${investigacionId}/translate?token=${this.env.ADMIN_TOKEN}`,
            { locale },
            this.env
          );
          return { locale, result };
        }
      );
    }

    return { investigacionId, locales: NON_CANONICAL_LOCALES.length };
  }
}

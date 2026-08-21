import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { translateInvestigacion } from "../../../../lib/investigacion-translate";
import { localeFromParam } from "../../../../lib/locales";

export const prerender = false;

// Translates one investigación into one locale, called per-locale by
// TranslateInvestigacionWorkflow (see scripts/translate-investigacion-workflow.mjs) so each
// locale is its own durable, independently-retryable Workflow step -- one locale failing
// (a model hiccup, a step timeout) never loses progress on the other ten.
export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const id = Number(params.id);
  const body = await request.json<{ locale?: string }>().catch(() => ({}) as any);
  const locale = localeFromParam(body?.locale ?? "");
  if (!locale || locale.canonical) {
    return new Response(JSON.stringify({ error: "invalid or canonical locale" }), { status: 400 });
  }

  const result = await translateInvestigacion(env, locale.code, id);
  return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
};

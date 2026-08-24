import type { APIRoute } from "astro";
import { buildTranscript, transcriptResponse } from "../../../../lib/transcript";
import { localeFromParam } from "../../../../lib/locales";
export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const slug = params.param;
  if (!slug) return new Response("not found", { status: 404 });
  const locale = localeFromParam(params.locale);
  if (!locale) return new Response("not found", { status: 404 });
  return transcriptResponse(await buildTranscript("columna", slug, locale.code, "audio_narration"));
};

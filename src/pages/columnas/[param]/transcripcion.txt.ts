import type { APIRoute } from "astro";
import { buildTranscript, transcriptResponse } from "../../../lib/transcript";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const slug = params.param;
  if (!slug) return new Response("not found", { status: 404 });

  return transcriptResponse(await buildTranscript("columna", slug, "es-MX", "audio_narration"));
};

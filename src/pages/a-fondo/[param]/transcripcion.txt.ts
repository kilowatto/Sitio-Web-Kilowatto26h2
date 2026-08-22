import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Plain-text transcript of a column's narration.
//
// This exists for GEO as much as SEO: answer engines and crawlers read text, not MP3s and not
// WebVTT cue timings. The VTT is already linked from the AudioObject for players, but a bare
// .txt is the form a retrieval pipeline can actually ingest. It also doubles as an
// accessibility affordance -- a reader who wants the spoken version's wording without playing
// six minutes of audio.
//
// Served from the stored script rather than re-deriving it: script_text is exactly what was
// spoken, so the transcript can never drift from the audio.
export const GET: APIRoute = async ({ params }) => {
  const slug = params.param;
  if (!slug) return new Response("not found", { status: 404 });

  const row = await env.DB.prepare(
    `SELECT c.title, c.subtitle, ma.script_text, ma.duration_s
       FROM investigaciones c
       JOIN media_assets ma
         ON ma.entity_type = 'investigacion' AND ma.entity_id = c.id
        AND ma.kind = 'audio_narration' AND ma.locale = 'es-MX'
        AND ma.status = 'ready'
      WHERE c.slug = ? AND c.status = 'published'`
  )
    .bind(slug)
    .first<{ title: string; subtitle: string | null; script_text: string | null; duration_s: number | null }>();

  if (!row?.script_text) return new Response("not found", { status: 404 });

  // The script carries <break time="0.6s" /> markers for the synthesizer; they are noise in a
  // transcript, so strip them and normalize the whitespace they leave behind.
  const body = row.script_text
    .replace(/<break\s+time="[^"]*"\s*\/?>/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const minutes = row.duration_s ? Math.round(row.duration_s / 60) : null;
  const header = [
    row.title,
    row.subtitle ?? "",
    "",
    `Transcripción de la versión narrada${minutes ? ` (${minutes} min)` : ""}.`,
    "Narrada con voz sintética (Larry). El texto es de Esteban Rey — kilowatto.com.",
    "",
    "---",
    "",
  ].join("\n");

  return new Response(header + body + "\n", {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { parseStoredTurns, turnsToTranscript } from "../../../lib/narrate-dialogue";

export const prerender = false;

// Plain-text transcript of the conversational episode, with speaker labels.
//
// Separate from transcripcion.txt, which is the faithful narration: they are different audio
// saying different things, and a podcast:transcript that does not match its enclosure is worse
// than none. Speaker labels are most of what a conversation transcript is for, which is why the
// turns are stored as JSON rather than flattened when the episode is built.
export const GET: APIRoute = async ({ params }) => {
  const slug = params.param;
  if (!slug) return new Response("not found", { status: 404 });

  const row = await env.DB.prepare(
    `SELECT i.title, i.subtitle, ma.script_text, ma.duration_s
       FROM investigaciones i
       JOIN media_assets ma
         ON ma.entity_type = 'investigacion' AND ma.entity_id = i.id
        AND ma.kind = 'audio_dialogue' AND ma.locale = 'es-MX'
        AND ma.status = 'ready'
      WHERE i.slug = ? AND i.status = 'published'`
  )
    .bind(slug)
    .first<{ title: string; subtitle: string | null; script_text: string | null; duration_s: number | null }>();

  const turns = parseStoredTurns(row?.script_text ?? null);
  if (!row || !turns) return new Response("not found", { status: 404 });

  const minutes = row.duration_s ? Math.round(row.duration_s / 60) : null;
  const header = [
    row.title,
    row.subtitle ?? "",
    "",
    `Conversación sobre la investigación${minutes ? ` (${minutes} min)` : ""}.`,
    "Larry y Leia son personajes; ambas voces son sintéticas. La investigación es de Esteban Rey.",
    "Esta conversación resume la pieza: no la reemplaza. El texto completo, con fuentes y",
    "gráficas, está en kilowatto.com.",
    "",
    "---",
    "",
  ].join("\n");

  return new Response(header + turnsToTranscript(turns) + "\n", {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};

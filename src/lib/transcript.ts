import { env } from "cloudflare:workers";
import { parseStoredTurns, turnsToTranscript } from "./narrate-dialogue";

// Plain-text transcripts of the audio, for every locale that has audio.
//
// Extracted into one place after finding that all 26 podcast:transcript URLs in the English feed
// were 404s: the routes only ever existed on the canonical Spanish paths, while the feed builds
// its transcript URL from the locale-prefixed page URL. The feed had been promising transcripts
// that did not exist since the day the English narrations shipped.
//
// These exist for GEO as much as SEO: answer engines and crawlers read text, not MP3s and not
// WebVTT cue timings, and a podcast:transcript that 404s is worse than none at all.

type Kind = "audio_narration" | "audio_dialogue";

const LABELS: Record<string, Record<string, string>> = {
  "es-MX": {
    reading: "Transcripción de la versión narrada",
    conversation: "Conversación sobre la investigación",
    narrationNote:
      "Narrada con voz sintética (Larry). El texto es de Esteban Rey — kilowatto.com.",
    conversationNote:
      "Kilowatto y Leia son personajes; ambas voces son sintéticas.\n" +
      "Esta conversación resume la pieza: no la reemplaza. El texto completo, con fuentes y\n" +
      "gráficas, está en kilowatto.com.",
    minutes: "min",
  },
  en: {
    reading: "Transcript of the narrated version",
    conversation: "Conversation about the investigation",
    narrationNote:
      "Narrated with a synthetic voice (Larry). The writing is Esteban Rey's — kilowatto.com.",
    conversationNote:
      "Kilowatto and Leia are characters; both voices are synthetic.\n" +
      "This conversation summarises the piece, it does not replace it. The full text, with\n" +
      "sources and charts, is on kilowatto.com.",
    minutes: "min",
  },
};

function labels(locale: string) {
  return LABELS[locale] ?? LABELS[locale.startsWith("en") ? "en" : "es-MX"];
}

export async function buildTranscript(
  entityType: "columna" | "investigacion",
  slug: string,
  locale: string,
  kind: Kind
): Promise<string | null> {
  const table = entityType === "columna" ? "columns" : "investigaciones";
  const row = await env.DB.prepare(
    `SELECT c.id, c.title, c.subtitle, ma.script_text, ma.duration_s
       FROM ${table} c
       JOIN media_assets ma
         ON ma.entity_type = ? AND ma.entity_id = c.id
        AND ma.kind = ? AND ma.locale = ? AND ma.status = 'ready'
      WHERE c.slug = ? AND c.status = 'published'`
  )
    .bind(entityType, kind, locale, slug)
    .first<{ id: number; title: string; subtitle: string | null; script_text: string | null; duration_s: number | null }>();

  if (!row?.script_text) return null;

  // Titles are translated per locale; a transcript headed by the Spanish title on an English
  // page is the same silent mismatch that made the first English narration read Spanish.
  let title = row.title;
  let subtitle = row.subtitle;
  if (locale !== "es-MX") {
    const tr = await env.DB.prepare(
      `SELECT field_key, value FROM translations
        WHERE entity_type = ? AND entity_id = ? AND locale = ? AND field_key IN ('title','subtitle')`
    )
      .bind(table, row.id, locale)
      .all<{ field_key: string; value: string }>();
    const byKey = new Map((tr.results ?? []).map((t) => [t.field_key, t.value]));
    title = byKey.get("title") ?? title;
    subtitle = byKey.get("subtitle") ?? subtitle;
  }

  const L = labels(locale);
  const minutes = row.duration_s ? Math.round(row.duration_s / 60) : null;
  const isDialogue = kind === "audio_dialogue";

  let body: string;
  if (isDialogue) {
    const turns = parseStoredTurns(row.script_text);
    if (!turns) return null;
    body = turnsToTranscript(turns);
  } else {
    // <break time="0.6s" /> markers are instructions for the synthesizer; in a transcript they
    // are noise.
    body = row.script_text
      .replace(/<break\s+time="[^"]*"\s*\/?>/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const header = [
    title,
    subtitle ?? "",
    "",
    `${isDialogue ? L.conversation : L.reading}${minutes ? ` (${minutes} ${L.minutes})` : ""}.`,
    isDialogue ? L.conversationNote : L.narrationNote,
    "",
    "---",
    "",
  ].join("\n");

  return header + body + "\n";
}

export function transcriptResponse(text: string | null): Response {
  if (!text) return new Response("not found", { status: 404 });
  return new Response(text, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

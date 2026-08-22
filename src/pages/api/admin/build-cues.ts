import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { alignAudio, alignLongAudio } from "../../../lib/elevenlabs";
import { buildCueMap } from "../../../lib/cue-map";

export const prerender = false;

// Builds the paragraph sync map for narration that already exists.
//
// Deliberately does NOT re-synthesize: the audio and the script are already stored, so this
// only re-runs forced alignment. Re-narrating to get cues would cost the full character price
// of the article for nothing.

function articleParagraphs(bodyHtml: string): string[] {
  // Must mirror what the browser will see: the same <p> elements, in the same order, that the
  // client script indexes into. Chart placeholders and inline figures render as siblings of
  // <p>, not as <p>, so they don't shift the indices.
  const out: string[] = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyHtml))) {
    const text = m[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    out.push(text);
  }
  return out;
}

export const POST: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const onlyType = url.searchParams.get("type");
  const onlyId = url.searchParams.get("id") ? Number(url.searchParams.get("id")) : null;
  const onlyLocale = url.searchParams.get("locale");

  let sql = `SELECT id, entity_type, entity_id, locale, r2_key, script_text
               FROM media_assets
              WHERE kind = 'audio_narration' AND status = 'ready'
                AND r2_key IS NOT NULL AND script_text IS NOT NULL`;
  const binds: any[] = [];
  if (onlyType) { sql += " AND entity_type = ?"; binds.push(onlyType); }
  if (onlyId) { sql += " AND entity_id = ?"; binds.push(onlyId); }
  if (onlyLocale) { sql += " AND locale = ?"; binds.push(onlyLocale); }
  if (url.searchParams.get("force") !== "1") sql += " AND cue_map_json IS NULL";

  const rows = await env.DB.prepare(sql).bind(...binds).all<any>();
  const results: any[] = [];

  for (const row of rows.results ?? []) {
    try {
      const table = row.entity_type === "columna" ? "columns" : "investigaciones";
      let bodyHtml: string | null = null;

      if (row.locale === "es-MX") {
        const article = await env.DB.prepare(`SELECT body_html FROM ${table} WHERE id = ?`)
          .bind(row.entity_id)
          .first<{ body_html: string }>();
        bodyHtml = article?.body_html ?? null;
      } else {
        // The cue map indexes the paragraphs the READER sees, and on a non-canonical locale
        // that is the translated body. Using the Spanish body here would compare English
        // narration against Spanish paragraphs and match nothing -- a silent 0% coverage.
        const t = await env.DB.prepare(
          `SELECT value FROM translations
            WHERE entity_type = ? AND entity_id = ? AND locale = ? AND field_key = 'body_html'`
        )
          .bind(table, row.entity_id, row.locale)
          .first<{ value: string }>();
        bodyHtml = t?.value ?? null;
      }

      if (!bodyHtml) {
        results.push({ id: row.id, error: `sin body_html para locale ${row.locale}` });
        continue;
      }

      // Long pieces are aligned chunk by chunk: alignAudio() buffers the whole MP3, which is
      // fine for a 6-minute column (~9 MB) and fatal for a 64-minute investigación (~90 MB)
      // in a 128 MB isolate. The threshold is deliberately conservative.
      const head = await env.MEDIA.head(row.r2_key);
      const bigFile = (head?.size ?? 0) > 20_000_000;
      const words = bigFile
        ? await alignLongAudio(row.script_text)
        : await alignAudio(row.r2_key, row.script_text);
      if (!words || words.length === 0) {
        results.push({ id: row.id, error: "alineación falló" });
        continue;
      }

      const paras = articleParagraphs(bodyHtml);
      const cues = buildCueMap(row.script_text, words, paras);

      await env.DB.prepare(`UPDATE media_assets SET cue_map_json = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(JSON.stringify(cues), row.id)
        .run();

      results.push({
        id: row.id,
        entity: `${row.entity_type}:${row.entity_id}`,
        locale: row.locale,
        paragraphs: paras.length,
        cues: cues.length,
        chunked: bigFile,
        // Coverage is the honest quality signal: a low number means the matcher rejected most
        // paragraphs rather than guessing, and the highlight will have gaps.
        coverage: paras.length ? Math.round((cues.length / paras.length) * 100) + "%" : "n/a",
      });
    } catch (err: any) {
      results.push({ id: row.id, error: String(err?.message ?? err).slice(0, 200) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { alignAudio } from "../../../lib/elevenlabs";
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

  let sql = `SELECT id, entity_type, entity_id, locale, r2_key, script_text
               FROM media_assets
              WHERE kind = 'audio_narration' AND status = 'ready'
                AND r2_key IS NOT NULL AND script_text IS NOT NULL`;
  const binds: any[] = [];
  if (onlyType) { sql += " AND entity_type = ?"; binds.push(onlyType); }
  if (onlyId) { sql += " AND entity_id = ?"; binds.push(onlyId); }
  if (url.searchParams.get("force") !== "1") sql += " AND cue_map_json IS NULL";

  const rows = await env.DB.prepare(sql).bind(...binds).all<any>();
  const results: any[] = [];

  for (const row of rows.results ?? []) {
    try {
      const table = row.entity_type === "columna" ? "columns" : "investigaciones";
      const article = await env.DB.prepare(`SELECT body_html FROM ${table} WHERE id = ?`)
        .bind(row.entity_id)
        .first<{ body_html: string }>();
      if (!article?.body_html) {
        results.push({ id: row.id, error: "artículo no encontrado" });
        continue;
      }

      const words = await alignAudio(row.r2_key, row.script_text);
      if (!words || words.length === 0) {
        results.push({ id: row.id, error: "alineación falló" });
        continue;
      }

      const paras = articleParagraphs(article.body_html);
      const cues = buildCueMap(row.script_text, words, paras);

      await env.DB.prepare(`UPDATE media_assets SET cue_map_json = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(JSON.stringify(cues), row.id)
        .run();

      results.push({
        id: row.id,
        entity: `${row.entity_type}:${row.entity_id}`,
        paragraphs: paras.length,
        cues: cues.length,
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

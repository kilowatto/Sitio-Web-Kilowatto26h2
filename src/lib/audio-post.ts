import { env } from "cloudflare:workers";
import { buildVoiceContext, voicePromptBlock } from "./brand-voice";
import { assignSmartSchedule } from "./post-scheduler";
import { createShortLink } from "./short-links";

// Announces a finished audio asset.
//
// The podcast shipped six conversational episodes and two directory listings on 2026-08-23 and
// the brand system did not notice any of it -- there is no path from the audio pipeline to
// brand_posts. This is that path.
//
// Deliberately narrow: ONE post per episode per platform, and only for pieces in the canonical
// locale. Two reasons. "This column now has audio" is barely news, so a batch of angles like the
// column generator produces would be padding; and 52 assets across two languages would put a
// hundred near-identical posts in the queue.

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const GUIDANCE: Record<string, string> = {
  x: "Máximo ~200 caracteres (se agrega un link corto después). Una sola idea, directo.",
  linkedin: "Entre 300 y 700 caracteres. Gancho en la primera línea, dos párrafos cortos.",
};

async function callAI(prompt: string, maxTokens: number): Promise<string | null> {
  const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens });
  const raw: string = typeof result?.response === "string" ? result.response : JSON.stringify(result?.response ?? "");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return typeof parsed?.content === "string" ? parsed.content : null;
  } catch {
    return null;
  }
}

export interface AudioPostResult {
  ok: boolean;
  created?: number;
  skipped?: string;
  error?: string;
}

export async function runAudioPost(
  entityType: "columna" | "investigacion",
  entityId: number,
  kind: "audio_narration" | "audio_dialogue"
): Promise<AudioPostResult> {
  try {
    const table = entityType === "columna" ? "columns" : "investigaciones";
    const piece = await env.DB.prepare(
      `SELECT c.title, c.subtitle, c.slug, ma.duration_s, ma.episode_number, ma.script_text
         FROM ${table} c
         JOIN media_assets ma ON ma.entity_type = ? AND ma.entity_id = c.id
        WHERE c.id = ? AND c.status = 'published'
          AND ma.kind = ? AND ma.locale = 'es-MX' AND ma.status = 'ready'`
    )
      .bind(entityType, entityId, kind)
      .first<any>();
    if (!piece) return { ok: true, skipped: "sin audio listo en es-MX o pieza no publicada" };

    // Idempotency: one announcement per asset, ever. The sweep re-runs every six hours and a
    // regenerated episode must not re-announce itself.
    //
    // Marked in variant_style rather than matched against source_url, which was the first
    // attempt and silently never matched: the short link REWRITES source_url after the insert,
    // so by the time the next run looked, the marker it was searching for was gone. Two
    // duplicate posts per call, every call.
    const marker = `audio:${kind}`;
    const existing = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM brand_posts
        WHERE kind = 'audio_highlight'
          AND ${entityType === "columna" ? "column_id" : "investigacion_id"} = ?
          AND variant_style = ?`
    )
      .bind(entityId, marker)
      .first<{ n: number }>();
    if ((existing?.n ?? 0) > 0) return { ok: true, skipped: "ya anunciado" };

    const isDialogue = kind === "audio_dialogue";
    const section = entityType === "columna" ? "columnas" : "a-fondo";
    const targetUrl = `https://kilowatto.com/${section}/${piece.slug}${isDialogue ? "?utm_content=conversacion" : ""}`;
    const minutes = piece.duration_s ? Math.round(piece.duration_s / 60) : null;

    // The conversation already carries a hook written for exactly this job: the cold open is a
    // question designed so you cannot leave without the answer. Reusing it beats asking a model
    // to invent a worse one.
    let hook = "";
    if (isDialogue && piece.script_text) {
      try {
        const turns = JSON.parse(piece.script_text);
        hook = (turns ?? []).slice(0, 3).map((t: any) => t.text).join(" ").replace(/\[[a-zA-Z ]+\]/g, "").trim().slice(0, 600);
      } catch {
        /* fall through to the title */
      }
    }

    const { voiceSamples, bioFacts, columnVoiceSamples, investigacionSamples } = await buildVoiceContext(env.DB);
    const voiceBlock = voicePromptBlock(voiceSamples, bioFacts, columnVoiceSamples, investigacionSamples);

    const created: number[] = [];
    const reserved = new Map<string, number>();

    for (const platform of ["x", "linkedin"] as const) {
      const prompt = `${voiceBlock}

${isDialogue
  ? `Acaba de salir un episodio de mi podcast "Al fondo con Kilowatto"${piece.episode_number ? `, el número ${piece.episode_number}` : ""}: una conversación de ${minutes ?? "varios"} minutos sobre mi investigación "${piece.title}".`
  : `Mi ${entityType === "columna" ? "columna" : "investigación"} "${piece.title}" ya se puede ESCUCHAR: versión narrada de ${minutes ?? "varios"} minutos.`}

${hook ? `Así abre el episodio:\n${hook}\n` : piece.subtitle ? `Bajada: ${piece.subtitle}\n` : ""}
Plataforma: ${platform}. ${GUIDANCE[platform]}
Idioma: español.

Escribe UN post que invite a escucharlo. ${isDialogue ? "Usa el gancho del arranque si sirve: es una pregunta diseñada para que no te puedas ir sin la respuesta." : "No exageres: que exista versión en audio es una comodidad, no una noticia."} No inventes cifras. NO incluyas link (se agrega aparte). NO incluyas hashtags en el texto.

Responde SOLO: {"content": "...", "hashtags": ["#Ejemplo"]}`;

      const content = await callAI(prompt, platform === "x" ? 400 : 700);
      if (!content) continue;

      const scheduledFor = await assignSmartSchedule(platform, reserved);
      const res = await env.DB.prepare(
        `INSERT INTO brand_posts (platform, kind, ${entityType === "columna" ? "column_id" : "investigacion_id"}, language, content, status, source_url, scheduled_for, variant_style)
         VALUES (?, 'audio_highlight', ?, 'es', ?, 'pending_approval', ?, ?, ?)`
      )
        .bind(platform, entityId, content, targetUrl, scheduledFor, marker)
        .run();
      const postId = res.meta.last_row_id as number;

      let shortUrl = targetUrl;
      try {
        shortUrl = await createShortLink(targetUrl, postId);
      } catch {
        /* the full URL still works */
      }
      await env.DB.prepare("UPDATE brand_posts SET content = ?, source_url = ? WHERE id = ?")
        .bind(`${content}\n\n${isDialogue ? "Escúchalo" : "Escúchala"} → ${shortUrl}`, shortUrl, postId)
        .run();
      created.push(postId);
    }

    return { ok: true, created: created.length };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

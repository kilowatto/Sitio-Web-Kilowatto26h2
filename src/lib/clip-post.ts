import { env } from "cloudflare:workers";
import { buildClipProps, type ClipProps } from "./clip-script";
import { synthesizeScript, concatChunksToR2 } from "./elevenlabs";
import { buildVoiceContext, voicePromptBlock } from "./brand-voice";
import { assignSmartSchedule } from "./post-scheduler";
import { createShortLink } from "./short-links";
import { responseText } from "./audio-script";
import { pickArm, assign } from "./experiments";

// A vertical clip, end to end: pick the piece, write the props, have Larry narrate them, render
// the video, and put it in the queue as a post like any other.
//
// The "like any other" is the point. Esteban was explicit that the clips must not be a separate
// module: "lo de los videos verticales debe ser parte integral del sistema de post automatico...
// deben ser el gancho para leer mas en el sitio". So a clip is a brand_posts row with kind
// 'clip' and a video_r2_key -- same queue, same approval, same scheduler, same tick, same short
// link back to the article. Nothing about it publishes on its own.

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// 192 kbps CBR, one decimal. The integer version in narrate.ts is fine for a duration label;
// a clip needs the real figure, because the composition's length IS the audio's length and half
// a second of rounding is a visible freeze or a cut-off word.
function audioSeconds(bytes: number): number {
  return Math.round((bytes / (192000 / 8)) * 10) / 10;
}

// A beat of silence after the last word so the CTA is readable and the loop does not slam shut
// on the final syllable.
const TAIL_SECONDS = 1.5;

const GUIDANCE: Record<string, string> = {
  x: "Máximo ~180 caracteres (se agrega un link corto después).",
  linkedin: "Entre 250 y 600 caracteres. Gancho en la primera línea.",
};

export interface ClipPostResult {
  ok: boolean;
  postIds?: number[];
  videoKey?: string;
  seconds?: number;
  warnings?: string[];
  /** Which experiment arms this clip was made with. */
  arms?: string[];
  skipped?: string;
  error?: string;
}

async function renderClip(props: ClipProps, key: string): Promise<number> {
  const binding = (env as any).RENDER;
  if (!binding) throw new Error("falta el service binding RENDER (kilowatto-render)");
  const secret = String((env as any).RENDER_SECRET ?? "");
  if (!secret) throw new Error("falta el secreto RENDER_SECRET");

  const res = await binding.fetch("https://render/render", {
    method: "POST",
    headers: { "content-type": "application/json", "x-render-secret": secret },
    // narration and warnings are ours, not the composition's -- sending them would put the whole
    // script into the video's input props for no reason.
    body: JSON.stringify({ compositionId: "Clip", key, inputProps: toInputProps(props) }),
  });
  if (!res.ok) throw new Error(`render ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body: any = await res.json();
  return Number(body?.bytes ?? 0);
}

function toInputProps(props: ClipProps & { audioSrc?: string }) {
  const { narration, warnings, _raw, ...rest } = props as any;
  return rest;
}

export interface ClipPostOptions {
  chartKey?: string;
  /**
   * Skip narration and render, and queue a video that is already in R2.
   *
   * Two real uses. Re-queueing a clip after a rejected caption should not pay to synthesize and
   * render the identical video again -- that is a few dollars for nothing. And while the render
   * container cannot be built (see docs/pendientes-esteban.md), it is the only way to put a real
   * clip in front of Esteban through the actual code path instead of hand-written SQL.
   */
  preRendered?: { videoKey: string; seconds: number };
}

export async function runClipPost(
  entityType: "columna" | "investigacion",
  entityId: number,
  opts: ClipPostOptions = {}
): Promise<ClipPostResult> {
  const { chartKey, preRendered } = opts;
  try {
    const table = entityType === "columna" ? "columns" : "investigaciones";
    const idColumn = entityType === "columna" ? "column_id" : "investigacion_id";
    const piece = await env.DB.prepare(
      `SELECT title, slug FROM ${table} WHERE id = ? AND status = 'published'`
    )
      .bind(entityId)
      .first<any>();
    if (!piece) return { ok: true, skipped: "la pieza no está publicada" };

    // One clip per piece, ever. Marked in variant_style for the same reason as the audio posts:
    // the shortener rewrites source_url after the insert, so a marker kept there is gone by the
    // time the next run looks for it.
    const marker = "clip:v1";
    const existing = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM brand_posts WHERE kind = 'clip' AND ${idColumn} = ? AND variant_style = ?`
    )
      .bind(entityId, marker)
      .first<{ n: number }>();
    if ((existing?.n ?? 0) > 0) return { ok: true, skipped: "ya tiene clip" };

    // Two knobs under test, independently: how long the clip runs, and whether it opens with a
    // question or with the figure. pickArm balances rather than randomizes -- see experiments.ts.
    const durationArm = await pickArm("clip_duration");
    const hookArm = await pickArm("clip_hook");

    const props = await buildClipProps(entityType, entityId, {
      chartKey,
      durationSeconds: preRendered?.seconds ?? (durationArm?.config as any)?.durationSeconds,
      hookStyle: (hookArm?.config as any)?.hookStyle,
    });
    if (!preRendered && !props.narration?.trim()) {
      return { ok: false, error: `no salió narración: ${props.warnings.join("; ")}` };
    }

    let videoKey: string;
    let seconds: number;

    if (preRendered) {
      const head = await env.MEDIA.head(preRendered.videoKey);
      if (!head) throw new Error(`el video ${preRendered.videoKey} no está en R2`);
      videoKey = preRendered.videoKey;
      seconds = preRendered.seconds;
    } else {
      // Larry narrates. Prosody chaining off: a clip is one breath, and chaining exists to keep
      // tone across a twenty-minute article -- here it only bleeds energy out of the one chunk
      // that matters.
      const narration = await synthesizeScript(props.narration, { stability: 0.35 }, false);
      const audioKey = `media/clips/${entityType}-${entityId}-narracion.mp3`;
      const audioBytes = await concatChunksToR2(narration.chunks, audioKey);
      seconds = Math.round((audioSeconds(audioBytes) + TAIL_SECONDS) * 10) / 10;

      // The composition's length comes from the audio, not the other way round. clip-script.ts
      // writes narration to a measured 14.65 chars/sec target, but the model lands near it, not
      // on it, and a fixed frame count would either cut Larry off or leave dead air.
      videoKey = `media/clips/${entityType}-${entityId}.mp4`;
      const videoBytes = await renderClip(
        {
          ...props,
          durationSeconds: seconds,
          audioSrc: `https://kilowatto.com/media/video/${audioKey}`,
        } as any,
        videoKey
      );
      if (!videoBytes) throw new Error("el render no devolvió bytes");
    }

    const section = entityType === "columna" ? "columnas" : "a-fondo";
    const targetUrl = `https://kilowatto.com/${section}/${piece.slug}?utm_content=clip`;

    const { voiceSamples, bioFacts, columnVoiceSamples, investigacionSamples } = await buildVoiceContext(env.DB);
    const voiceBlock = voicePromptBlock(voiceSamples, bioFacts, columnVoiceSamples, investigacionSamples);

    const postIds: number[] = [];
    const reserved = new Map<string, number>();

    for (const platform of ["x", "linkedin"] as const) {
      const prompt = `${voiceBlock}

Tengo un video vertical de ${Math.round(seconds)} segundos sobre mi ${entityType === "columna" ? "columna" : "investigación"} "${piece.title}".

El video arranca con este gancho: "${props.hook}"
${props.items.length ? `Y muestra estos datos:\n${props.items.map((i) => `- ${i.label}: ${i.displayValue}`).join("\n")}` : ""}

Plataforma: ${platform}. ${GUIDANCE[platform]}
Idioma: español.

Escribe el texto que acompaña al video. El video ya cuenta el dato, así que el texto NO lo repite: da la razón para ir a leer la pieza completa. No inventes cifras. NO incluyas link (se agrega aparte). NO incluyas hashtags.

Responde SOLO: {"content": "..."}`;

      const raw = await env.AI.run(MODEL, {
        messages: [{ role: "user", content: prompt }],
        max_tokens: platform === "x" ? 400 : 700,
      });
      const match = responseText((raw as any)?.response).match(/\{[\s\S]*\}/);
      if (!match) continue;
      let content = "";
      try {
        content = String(JSON.parse(match[0])?.content ?? "");
      } catch {
        continue;
      }
      if (!content.trim()) continue;

      const scheduledFor = await assignSmartSchedule(platform, reserved);
      const res = await env.DB.prepare(
        `INSERT INTO brand_posts (platform, kind, ${idColumn}, language, content, status, source_url, video_r2_key, scheduled_for, variant_style)
         VALUES (?, 'clip', ?, 'es', ?, 'pending_approval', ?, ?, ?, ?)`
      )
        .bind(platform, entityId, content, targetUrl, videoKey, scheduledFor, marker)
        .run();
      const postId = res.meta.last_row_id as number;

      // The link goes in the post text on LinkedIn but stays out of X's: X charges $0.015 a post
      // and $0.20 when it carries a URL, so on X the link belongs in a reply. That reply is not
      // wired yet -- until it is, the X clip points at the site by name and the shortener still
      // records the row.
      let shortUrl = targetUrl;
      try {
        shortUrl = await createShortLink(targetUrl, postId);
      } catch {
        /* the full URL still works */
      }
      await env.DB.prepare("UPDATE brand_posts SET content = ?, source_url = ? WHERE id = ?")
        .bind(platform === "linkedin" ? `${content}\n\nLa pieza completa → ${shortUrl}` : content, shortUrl, postId)
        .run();
      if (durationArm) await assign("clip_duration", durationArm.arm, "brand_post", postId);
      if (hookArm) await assign("clip_hook", hookArm.arm, "brand_post", postId);
      postIds.push(postId);
    }

    return {
      ok: true,
      postIds,
      videoKey,
      seconds,
      warnings: props.warnings,
      arms: [durationArm?.arm, hookArm?.arm].filter(Boolean) as string[],
    };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

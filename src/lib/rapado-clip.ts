import { env } from "cloudflare:workers";
import { synthesizeScript, concatChunksToR2, alignAudio, type AlignedWord } from "./elevenlabs";
import { assignSmartSchedule } from "./post-scheduler";
import { createShortLink } from "./short-links";
import type { MontageBeat } from "../../remotion/src/PhotoMontage";

// A one-off personal clip: Esteban shaved his head today, sent 53 photos of the process, and
// asked for a sarcastic Larry-narrated montage -- vertical, for a temporary homepage section and
// a LinkedIn post. Not a general system (unlike clip-post.ts, which serves every future
// columna/investigación): this is a single hardcoded video, built once. If a "narrate a photo set"
// feature becomes a recurring need, generalize then -- not before.
//
// Larry never appears on screen here -- ElevenLabs Flows' only image+audio model
// (creatify-aurora) doesn't animate his face at all (confirmed directly against the live API:
// no mouth movement at any guidance_scale/audio_guidance_scale, no prompt field exists to drive
// a performance, and the dedicated Lipsync Generation node (OmniHuman/Veed) that DOES lip-sync
// isn't exposed via API yet -- Flows' own docs still say "planned for a future release"). He
// stays the narrator throughout (it's his voice on the single master track); the two bookend
// lines just play over real photos instead of his portrait. See docs/sprint-fase3-4.md's
// "Bloque C" for the HeyGen/ElevenLabs history that led here.
const PHOTOS = "https://kilowatto.com/media/personal/rapado-2026-08";

interface ScriptLine {
  text: string;
  imageSrc: string;
  fit?: "cover" | "contain";
}

export const RAPADO_SCRIPT_LINES: ScriptLine[] = [
  {
    text: "Tenemos que hablar de una decisión de vida muy importante que tomó Esteban Rey hoy.",
    imageSrc: `${PHOTOS}/rapado-01.webp`,
  },
  { text: "Miren nada más. Con pelo. Como toda su vida.", imageSrc: `${PHOTOS}/rapado-01.webp` },
  {
    text: "Y de repente, sin junta de accionistas, sin aprobación del consejo, decidió raparse.",
    imageSrc: `${PHOTOS}/rapado-06.webp`,
  },
  {
    text: "Ahí está. Liso. Brillante. Como yo, pero sin el cuerno y sin ser naranja.",
    imageSrc: `${PHOTOS}/rapado-02.webp`,
  },
  {
    text: "Toalla caliente, para que se sienta importante mientras toma esta decisión tan trascendental.",
    imageSrc: `${PHOTOS}/rapado-29.webp`,
  },
  {
    text: "Navaja. En la garganta. De un señor que apenas conoce. Yo no tengo esa confianza ni con mi dentista.",
    imageSrc: `${PHOTOS}/rapado-33.webp`,
  },
  {
    text: "La barba sí se salvó. Alguien tenía que quedar con canas de sabiduría.",
    imageSrc: `${PHOTOS}/rapado-22.webp`,
  },
  {
    text: "Y aquí, platicando tan tranquilo, como si no se acabara de quedar sin pelo por decisión propia.",
    imageSrc: `${PHOTOS}/rapado-16.webp`,
  },
  {
    text: "¿Segunda vuelta? Se ve que le gustó tanto que no se quiso ir.",
    imageSrc: `${PHOTOS}/rapado-23.webp`,
  },
  {
    text: "Y aquí el resultado: lentes oscuros, cero pelo, mucha confianza. LinkedIn no está listo para este post.",
    imageSrc: `${PHOTOS}/rapado-38.webp`,
  },
  {
    text: "Felicidades, Esteban. Que la calvicie te sea leve... ¡jajajaja, pelón!",
    imageSrc: `${PHOTOS}/rapado-35.webp`,
  },
];

const AUDIO_KEY = "media/clips/rapado-2026-08-30-narracion.mp3";
const VIDEO_KEY = "media/clips/rapado-2026-08-30.mp4";
const TARGET_URL = "https://kilowatto.com/#rapado";
const TAIL_SECONDS = 1.4;
const CHARS_PER_SECOND = 14.65; // Same house pacing constant as clip-script.ts, used only as a fallback.

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Real per-line timing from forced word-alignment: consume each line's word count, in order, off
 * the aligned word list. Falls back to a chars-per-second estimate (same constant Clip.tsx's bar
 * chart uses) if the alignment's word count doesn't match the script's -- better an approximate
 * cut than a thrown error over a personal video nobody's paying to re-render.
 */
function timeBeats(lines: ScriptLine[], aligned: AlignedWord[] | null): { start: number; end: number }[] {
  const totalWords = lines.reduce((n, l) => n + words(l.text).length, 0);
  if (aligned && aligned.length >= totalWords) {
    const out: { start: number; end: number }[] = [];
    let cursor = 0;
    for (const line of lines) {
      const n = words(line.text).length;
      const slice = aligned.slice(cursor, cursor + n);
      out.push({ start: slice[0].start, end: slice[slice.length - 1].end });
      cursor += n;
    }
    return out;
  }

  // Fallback: proportional chars-per-second estimate.
  let t = 0;
  const out: { start: number; end: number }[] = [];
  for (const line of lines) {
    const dur = line.text.length / CHARS_PER_SECOND;
    out.push({ start: t, end: t + dur });
    t += dur + 0.35; // a small gap between lines, since there's no real pause data here
  }
  return out;
}

export interface RapadoClipResult {
  ok: boolean;
  postId?: number;
  videoKey?: string;
  seconds?: number;
  usedAlignment?: boolean;
  error?: string;
}

export async function runRapadoClip(): Promise<RapadoClipResult> {
  try {
    const fullScript = RAPADO_SCRIPT_LINES.map((l) => l.text).join(" ");

    // One breath, like clip-post.ts's clips: prosody chaining exists to keep tone across a long
    // article, and would only bleed energy out of a 50-second sketch.
    const narration = await synthesizeScript(fullScript, { stability: 0.35 }, false);
    await concatChunksToR2(narration.chunks, AUDIO_KEY);

    const aligned = await alignAudio(AUDIO_KEY, fullScript).catch(() => null);
    const timings = timeBeats(RAPADO_SCRIPT_LINES, aligned);

    const beats: MontageBeat[] = RAPADO_SCRIPT_LINES.map((line, i) => {
      const isLast = i === RAPADO_SCRIPT_LINES.length - 1;
      const nextStart = isLast ? timings[i].end + TAIL_SECONDS : timings[i + 1].start;
      return {
        imageSrc: line.imageSrc,
        caption: line.text,
        durationSeconds: Math.max(0.6, nextStart - timings[i].start),
        fit: line.fit,
      };
    });
    const totalSeconds = Math.round(beats.reduce((s, b) => s + b.durationSeconds, 0) * 10) / 10;

    const binding = (env as any).RENDER;
    if (!binding) throw new Error("falta el service binding RENDER (kilowatto-render)");
    const secret = String((env as any).RENDER_SECRET ?? "");
    if (!secret) throw new Error("falta el secreto RENDER_SECRET");

    const inputProps = { beats, durationSeconds: totalSeconds, audioSrc: `https://kilowatto.com/media/video/${AUDIO_KEY}` };
    const res = await binding.fetch("https://render/render", {
      method: "POST",
      headers: { "content-type": "application/json", "x-render-secret": secret },
      // A distinct instance name, not the shared "renderer" default: a live container instance
      // does NOT pick up a freshly-deployed image on its own (see render-worker/src/index.ts's
      // own comment on this) -- bump the suffix whenever PhotoMontage.tsx changes, so the render
      // lands on a fresh instance that actually has the latest bundle.
      body: JSON.stringify({ compositionId: "PhotoMontage", key: VIDEO_KEY, inputProps, instance: "renderer-photomontage-v3" }),
    });
    if (!res.ok) throw new Error(`render ${res.status}: ${(await res.text()).slice(0, 300)}`);

    // This clip's video lives at a single fixed R2 key -- re-running this (e.g. after a script or
    // photo change) overwrites that same key, not a new one. Only make the LinkedIn post the
    // first time; a re-render must not insert a second brand_posts row.
    const existing = await env.DB.prepare("SELECT id FROM brand_posts WHERE video_r2_key = ? LIMIT 1")
      .bind(VIDEO_KEY)
      .first<{ id: number }>();
    if (existing) {
      return { ok: true, postId: existing.id, videoKey: VIDEO_KEY, seconds: totalSeconds, usedAlignment: !!aligned };
    }

    // One LinkedIn post, per Esteban's explicit ask -- not X, not both. Same queue/approval/tick
    // as every other post: nothing here publishes on its own.
    const scheduledFor = await assignSmartSchedule("linkedin");
    const content =
      "Hoy pasó algo importante: me rapé. Larry no se guardó su opinión.\n\n" +
      "El proceso completo, narrado con todo el sarcasmo que se merece.";
    const insert = await env.DB.prepare(
      `INSERT INTO brand_posts (platform, kind, language, content, status, source_url, video_r2_key, scheduled_for)
       VALUES ('linkedin', 'clip', 'es', ?, 'pending_approval', ?, ?, ?)`
    )
      .bind(content, TARGET_URL, VIDEO_KEY, scheduledFor)
      .run();
    const postId = insert.meta.last_row_id as number;

    let shortUrl = TARGET_URL;
    try {
      shortUrl = await createShortLink(TARGET_URL, postId);
    } catch {
      /* the full URL still works */
    }
    await env.DB.prepare("UPDATE brand_posts SET content = ?, source_url = ? WHERE id = ?")
      .bind(`${content}\n\nVe el video completo → ${shortUrl}`, shortUrl, postId)
      .run();

    return { ok: true, postId, videoKey: VIDEO_KEY, seconds: totalSeconds, usedAlignment: !!aligned };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

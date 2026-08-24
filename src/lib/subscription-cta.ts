import { env } from "cloudflare:workers";
import { assignSmartSchedule } from "./post-scheduler";
import { createShortLink } from "./short-links";
import { getDownloadTotals } from "./podcast-downloads";

// Asks people to subscribe to the podcast, but only when asking is worth a post.
//
// Esteban's rule (2026-08-23): after a download spike, or every 12 posts as a floor. Both halves
// matter. Waiting only for a spike means never asking while the show has no audience -- which is
// exactly when asking helps most. Asking on a fixed cadence alone wastes the good moments.
//
// The destination is /podcast, not an episode: a subscribe CTA needs somewhere that is about the
// show.

const SPACING = 12; // posts of any kind between CTAs, as the floor
const SPIKE_RATIO = 1.8; // recent days against the trailing average
// Below this many downloads in the trailing month there is no baseline to spike against, and
// anything at all looks like one -- the first test downloads registered as a spike against zero.
// Under the floor only the spacing rule fires, which is the honest behaviour while the show has
// no audience yet.
const MIN_BASELINE = 40;

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export interface CtaDecision {
  shouldPost: boolean;
  reason: string;
  postsSinceLast: number;
  spike: boolean;
}

export async function shouldPostCta(): Promise<CtaDecision> {
  const since = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM brand_posts
      WHERE status = 'posted'
        AND posted_at > COALESCE(
          (SELECT MAX(posted_at) FROM brand_posts WHERE kind = 'subscription_cta' AND status = 'posted'),
          '2000-01-01')`
  ).first<{ n: number }>();
  const postsSinceLast = Number(since?.n ?? 0);

  // A spike is measured against our own downloads, which is the only signal either directory
  // will give us -- neither Apple nor Spotify exposes listening numbers by API.
  let spike = false;
  try {
    const [recent, baseline] = await Promise.all([getDownloadTotals(2), getDownloadTotals(30)]);
    if (recent && baseline && baseline.downloads >= MIN_BASELINE) {
      const dailyRecent = recent.downloads / 2;
      const dailyBaseline = baseline.downloads / 30;
      spike = dailyBaseline > 0 && dailyRecent >= dailyBaseline * SPIKE_RATIO && recent.downloads >= 6;
    }
  } catch {
    /* no telemetry is not a reason to never ask */
  }

  // Never twice in a row, even on a spike: a queue with two CTAs pending would fire both.
  const pending = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM brand_posts WHERE kind = 'subscription_cta' AND status IN ('pending_approval','approved')`
  ).first<{ n: number }>();
  if ((pending?.n ?? 0) > 0) {
    return { shouldPost: false, reason: "ya hay un CTA en cola", postsSinceLast, spike };
  }

  if (spike) return { shouldPost: true, reason: "pico de descargas", postsSinceLast, spike };
  if (postsSinceLast >= SPACING) {
    return { shouldPost: true, reason: `${postsSinceLast} posts desde el último`, postsSinceLast, spike };
  }
  return { shouldPost: false, reason: `solo ${postsSinceLast} posts desde el último`, postsSinceLast, spike };
}

export interface CtaResult {
  created: number;
  reason: string;
}

export async function runSubscriptionCta(force = false): Promise<CtaResult> {
  const decision = await shouldPostCta();
  if (!decision.shouldPost && !force) return { created: 0, reason: decision.reason };

  const stats = await env.DB.prepare(
    `SELECT COUNT(*) AS n, CAST(SUM(duration_s) / 60 AS INT) AS minutes
       FROM media_assets WHERE kind IN ('audio_narration','audio_dialogue') AND status='ready' AND locale='es-MX'`
  ).first<{ n: number; minutes: number }>();

  const targetUrl = "https://kilowatto.com/podcast";
  const created: number[] = [];
  const reserved = new Map<string, number>();

  for (const platform of ["x", "linkedin"] as const) {
    const prompt = `Escribe UN post para ${platform} invitando a suscribirse a mi podcast "Al fondo con Kilowatto".

Qué es: conversaciones de unos 10 a 17 minutos entre Kilowatto y Leia sobre cada investigación de A fondo, más la lectura completa de cada pieza y las columnas narradas. ${stats?.n ?? 0} episodios, ${stats?.minutes ?? 0} minutos. Está en Spotify y en Apple Podcasts.

${platform === "x" ? "Máximo ~200 caracteres, se agrega un link corto aparte." : "Entre 300 y 600 caracteres, dos párrafos cortos."}
Idioma: español. Tono directo, sin superlativos ni "no te lo pierdas". No inventes cifras. NO incluyas link ni hashtags.

Responde SOLO: {"content": "..."}`;

    const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: platform === "x" ? 300 : 600 });
    const raw: string = typeof result?.response === "string" ? result.response : JSON.stringify(result?.response ?? "");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) continue;
    let content: string;
    try {
      content = String(JSON.parse(match[0])?.content ?? "");
    } catch {
      continue;
    }
    if (!content) continue;

    const scheduledFor = await assignSmartSchedule(platform, reserved);
    const res = await env.DB.prepare(
      `INSERT INTO brand_posts (platform, kind, language, content, status, source_url, scheduled_for, variant_style)
       VALUES (?, 'subscription_cta', 'es', ?, 'pending_approval', ?, ?, ?)`
    )
      .bind(platform, content, targetUrl, scheduledFor, decision.reason)
      .run();
    const postId = res.meta.last_row_id as number;

    let shortUrl = targetUrl;
    try {
      shortUrl = await createShortLink(targetUrl, postId);
    } catch {
      /* full URL still works */
    }
    await env.DB.prepare("UPDATE brand_posts SET content = ?, source_url = ? WHERE id = ?")
      .bind(`${content}\n\n${shortUrl}`, shortUrl, postId)
      .run();
    created.push(postId);
  }

  return { created: created.length, reason: decision.reason };
}

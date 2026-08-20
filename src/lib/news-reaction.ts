import { env } from "cloudflare:workers";
import { buildVoiceContext, voicePromptBlock } from "./brand-voice";
import { generateLarryScene } from "./brand-image";
import { createShortLink } from "./short-links";
import type { NewsCandidate, NewsClassification } from "./tech-news";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const PLATFORM_GUIDANCE: Record<string, string> = {
  x: "Máximo ~260 caracteres. Reacción directa, sin relleno.",
  linkedin: "Entre 300 y 700 caracteres. Cuenta brevemente qué pasó y da tu reflexión/opinión — gancho fuerte en la primera línea.",
};

// Breaking news is worthless in 24h; analysis/trend pieces age slower. Esteban reviews the
// panel "varias veces al día" — a 3h window for breaking still reaches him fresh most of
// the time without going stale, 36h covers a couple of review passes for slower analysis.
const EXPIRY_HOURS: Record<string, number> = { breaking: 3, analysis: 36 };

function stripTrailingHashtags(text: string): string {
  return text.replace(/(\s*#[\wÀ-ÿ]+)+\s*$/u, "").trim();
}

async function callAI(prompt: string, maxTokens: number) {
  const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens });
  if (result?.response && typeof result.response === "object") return result.response;
  const raw: string = typeof result?.response === "string" ? result.response : "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// Grounds against the news item ONLY (title + the AI's own one-line factual summary,
// itself instructed to never go beyond the title) — same zero-invention discipline as the
// bio fact-check, applied here because news is exactly the kind of content where it's easy
// to accidentally fabricate a number or detail that was never actually reported.
async function factCheckAgainstNews(content: string, item: NewsCandidate, classification: NewsClassification) {
  const prompt = `Revisa este post que reacciona a una noticia real. Compáralo SOLO contra estos datos verificados de la noticia:\nTítulo: "${item.title}"\nResumen: "${classification.summary}"\n\nPost:\n"${content}"\n\n¿El post inventa alguna cifra, cita textual o dato específico que NO esté en el título/resumen de arriba? Una opinión o reflexión personal no cuenta como invención. Responde SOLO un JSON: {"grounded": true|false, "issue": "descripción breve si grounded es false, si no cadena vacía"}`;
  const result = await callAI(prompt, 200);
  return result ?? { grounded: true, issue: "" };
}

export interface GeneratedNewsReaction {
  postId: number;
  platform: "x" | "linkedin";
  flagged: boolean;
}

export async function generateNewsReactionPost(
  item: NewsCandidate,
  classification: NewsClassification,
  platform: "x" | "linkedin"
): Promise<GeneratedNewsReaction | null> {
  const { voiceSamples, bioFacts } = await buildVoiceContext(env.DB);
  const voiceBlock = voicePromptBlock(voiceSamples, bioFacts);

  const prompt = `${voiceBlock}

Noticia real a la que vas a reaccionar:
Título: "${item.title}"
Fuente: ${item.source}
Resumen verificado: ${classification.summary}

Plataforma: ${platform}. ${PLATFORM_GUIDANCE[platform]}
Idioma: español.

Genera EXACTAMENTE 2 variantes de un post reaccionando/comentando esta noticia, en primera persona, con tu tono real (serio, no solemne, irónico sin insultar a nadie):
1. "casual_sin_liga": estilo más suelto e irónico, cuenta la noticia a tu manera SIN mencionar que vas a poner un link (el link se agrega aparte).
2. "formal_con_cita": estilo más formal, mencionando la fuente explícitamente (ej. "según ${item.source}") como si fueras a citarla con un link.

No inventes ninguna cifra, cita textual o detalle que no esté en el resumen verificado de arriba.

Los hashtags van SOLO en el campo "hashtags", nunca dentro de "content". Máximo ${platform === "x" ? 2 : 3} hashtags contextuales específicos (no genéricos).

Responde SOLO un JSON:
{"variants": [{"style": "casual_sin_liga", "content": "texto SIN hashtags", "hashtags": ["#Ejemplo"]}, {"style": "formal_con_cita", "content": "texto SIN hashtags", "hashtags": ["#Ejemplo"]}]}`;

  const generated = await callAI(prompt, 700);
  const variants: { style: string; content: string; hashtags?: string[] }[] = generated?.variants ?? [];
  if (variants.length === 0) return null;

  // One shared image for the pair, like the idea-compositor and topic generator — Larry
  // doing something concretely tied to the actual story, not a generic reaction pose.
  const imageKey = await generateLarryScene(item.title, classification.summary);

  const expiresAt = new Date(Date.now() + EXPIRY_HOURS[classification.urgency] * 3600_000).toISOString().slice(0, 19).replace("T", " ");
  const neverAuto = classification.neverAuto ? 1 : 0;
  const variantGroup = crypto.randomUUID();

  let firstId: number | null = null;

  for (const v of variants) {
    if (!v?.content) continue;
    const cleanContent = stripTrailingHashtags(v.content);
    const check = await factCheckAgainstNews(cleanContent, item, classification);
    const rejectionNote = check.grounded === false ? `fact-check: ${check.issue}` : null;

    const res = await env.DB.prepare(
      `INSERT INTO brand_posts (platform, kind, language, content, source_url, variant_group, variant_style, status, rejection_reason, image_r2_key, hashtags, expires_at, never_auto)
       VALUES (?, 'news_reaction', 'es', ?, ?, ?, ?, 'pending_approval', ?, ?, ?, ?, ?)`
    )
      .bind(
        platform,
        cleanContent,
        item.link,
        variantGroup,
        v.style ?? null,
        rejectionNote,
        imageKey,
        (v.hashtags ?? []).join(" ") || null,
        expiresAt,
        neverAuto
      )
      .run();

    if (v.style === "formal_con_cita" && !rejectionNote) {
      // Swap in a real tracked short link for the "cita con liga" variant only — the casual
      // variant deliberately stays link-free per Esteban's call.
      try {
        const shortUrl = await createShortLink(item.link, res.meta.last_row_id as number);
        const withLink = `${cleanContent}\n\n${shortUrl}`;
        await env.DB.prepare("UPDATE brand_posts SET content = ? WHERE id = ?").bind(withLink, res.meta.last_row_id).run();
      } catch {
        // short link creation failed — leave the post as-is without a link rather than fail the whole generation
      }
    }

    firstId = firstId ?? (res.meta.last_row_id as number);
  }

  if (firstId === null) return null;
  return { postId: firstId, platform, flagged: false };
}

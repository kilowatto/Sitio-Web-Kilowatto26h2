import type { APIRoute } from "astro";
import { bloqueDeReglas, revisarPost, mismaApertura, pieDeEnlace, idiomaDe, MAX_CHARS } from "../../../../lib/post-reglas";
import { env } from "cloudflare:workers";
import { buildVoiceContext, voicePromptBlock } from "../../../../lib/brand-voice";
import { proposeImage, type ImageStyle } from "../../../../lib/brand-image";
import { assignSmartSchedule } from "../../../../lib/post-scheduler";
import { createShortLink } from "../../../../lib/short-links";

export const prerender = false;

// Esteban (2026-08-21, after seeing the first test batch land with no images at
// all -- it reused a cover_r2_key that didn't exist): every post needs its OWN
// distinct image, and the batch must always mix infographic/illustration/photo
// styles, never all one style. "real_photo" is deliberately excluded from the
// default rotation -- it only matches Esteban's own approved photo gallery by
// keyword, which real-world investigación topics (VPNs, arquitectura de
// software, etc.) essentially never hit, and proposeImage() has no AI fallback
// for that style, so including it here would silently produce null images.
const DEFAULT_STYLE_ROTATION: ImageStyle[] = ["infographic", "illustration", "photorealistic"];

async function withConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Same model already used for every other brand_posts generation path (see
// api/brand/generate.ts) -- keep it consistent rather than picking a second one.
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// La guía de longitud vivía aquí con "~230 caracteres" y "entre 400 y 900". Ahora la forma del
// post la define src/lib/post-reglas.ts, que además la VERIFICA después de generar -- el modelo
// trataba el largo como sugerencia y salían 291 caracteres de promedio en LinkedIn.

async function callAI(prompt: string, maxTokens: number) {
  const result: any = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens });
  const raw: string = typeof result?.response === "string" ? result.response : JSON.stringify(result?.response ?? "");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function htmlToPlain(html: string, maxLen: number): string {
  const text = html.replace(/<!--chart:[^>]+-->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

async function generateBatch(
  platform: "x" | "linkedin",
  count: number,
  investigacion: any,
  sourcesBlock: string,
  bodyPlain: string,
  voiceBlock: string,
  idioma: "es" | "en"
) {
  if (count <= 0) return [];
  // Se pide el doble de lo que se necesita porque el filtro de forma descarta mucho: en la
  // primera corrida real con los topes nuevos, de 8 posts pedidos para una columna sobrevivieron
  // 3. El modelo trata el largo como sugerencia, así que el margen es la única forma de llegar
  // al número sin bajar la vara.
  const pedidos = Math.min(count * 2, count + 12);
  const prompt = `${voiceBlock}

Ya publiqué esta investigación completa en kilowatto.com/a-fondo: "${investigacion.title}"
Resumen: ${investigacion.summary}

Extracto del cuerpo (para sacar datos e ideas puntuales, usa SOLO información que aparezca aquí o en la lista de fuentes -- no inventes cifras nuevas):
${bodyPlain}

Fuentes citadas en la pieza (para dar contexto, no las repitas literalmente en cada post):
${sourcesBlock}

Plataforma: ${platform}.\n${bloqueDeReglas(platform, idioma)}
Idioma: español.

Genera EXACTAMENTE ${pedidos} posts DISTINTOS entre sí (cada uno sacando un dato, cifra o idea puntual diferente de la investigación -- no repitas el mismo gancho ni la misma cifra dos veces), pensados para publicarse repartidos a lo largo de más de un mes, no todos el mismo día. NO incluyas ningún link en "content" -- el link de "sigue leyendo" se agrega aparte automáticamente después. NO incluyas hashtags dentro de "content", van solo en "hashtags" (máximo ${platform === "x" ? 2 : 3}, contextuales al dato específico de ese post, nunca genéricos).

Responde SOLO un JSON:
{"posts": [{"content": "texto del post, sin link, sin hashtags", "hashtags": ["#Ejemplo"]}, ...]}`;

  const maxTokens = platform === "x" ? Math.min(8000, 180 * pedidos) : Math.min(8000, 340 * pedidos);
  const generated = await callAI(prompt, maxTokens);
  const posts: { content: string; hashtags?: string[] }[] = generated?.posts ?? [];

  // Sliced to `count`, because the model treats "EXACTAMENTE N" as a suggestion: a backfill run
  // asking for 2 per column returned between 1 and 4 (2026-08-23). Every extra post costs an
  // image generation and a queue slot, so the cap has to be enforced here rather than requested
  // in the prompt.
  // Se verifica lo que el prompt pidió. Un post que rompe el tope o usa una palabra vetada se
  // descarta aquí en vez de llegar a la cola: el modelo trata las instrucciones de forma como
  // sugerencias, y así salieron "¡Genial! AWS resolvió..." y párrafos de 291 caracteres.
  const limpios: typeof posts = [];
  for (const p of posts) {
    if (!p?.content || !revisarPost(p.content, platform).ok) continue;
    limpios.push(p);
  }
  if (limpios.length < posts.length) {
    console.log(`descartados ${posts.length - limpios.length} posts de ${platform} por forma (tope ${MAX_CHARS[platform]})`);
  }
  return limpios.slice(0, count);
}

export async function runGeneratePosts(investigacionId: number, count = 30, styleOverride?: ImageStyle[]) {
  const investigacion = await env.DB.prepare("SELECT * FROM investigaciones WHERE id = ? AND status = 'published'")
    .bind(investigacionId)
    .first<any>();
  if (!investigacion) return { error: "investigación no encontrada o no está publicada" };

  const sources = await env.DB.prepare(
    "SELECT label, url, confidence FROM investigacion_sources WHERE investigacion_id = ? ORDER BY position LIMIT 30"
  )
    .bind(investigacionId)
    .all<any>();
  const sourcesBlock = (sources.results ?? []).map((s: any) => `- ${s.label} (${s.confidence})`).join("\n") || "(sin fuentes registradas)";
  const bodyPlain = htmlToPlain(investigacion.body_html, 6000);

  const { voiceSamples, bioFacts, columnVoiceSamples, investigacionSamples } = await buildVoiceContext(env.DB);
  const voiceBlock = voicePromptBlock(voiceSamples, bioFacts, columnVoiceSamples, investigacionSamples);

  const xCount = Math.ceil(count / 2);
  const linkedinCount = count - xCount;

  const [xEs, xEn, liEs, liEn] = await Promise.all([
    // Español e inglés alternando: la pieza ya está traducida a los once locales y el enlace
    // manda a /en/a-fondo, que responde. Se generan dos tandas por plataforma, la mitad en cada
    // idioma, para que el feed alterne en vez de agrupar.
    generateBatch("x", Math.ceil(xCount / 2), investigacion, sourcesBlock, bodyPlain, voiceBlock, "es"),
    generateBatch("x", Math.floor(xCount / 2), investigacion, sourcesBlock, bodyPlain, voiceBlock, "en"),
    generateBatch("linkedin", Math.ceil(linkedinCount / 2), investigacion, sourcesBlock, bodyPlain, voiceBlock, "es"),
    generateBatch("linkedin", Math.floor(linkedinCount / 2), investigacion, sourcesBlock, bodyPlain, voiceBlock, "en"),
  ]);

  // Intercalados, no concatenados: si se pegan las tandas, el feed publica una racha en español
  // y luego otra en inglés en vez de alternar.
  const zip = <T,>(a: T[], b: T[]): T[] => {
    const out: T[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i]) out.push(a[i]);
      if (b[i]) out.push(b[i]);
    }
    return out;
  };
  const todos = [
    ...zip(xEs, xEn).map((p) => ({ ...p, platform: "x" as const })),
    ...zip(liEs, liEn).map((p) => ({ ...p, platform: "linkedin" as const })),
  ];
  // Deduplicar por apertura AQUÍ y no dentro de cada tanda: español e inglés se generan por
  // separado y no se ven entre sí, así que "¿Qué pasa cuando..." pasaba dos veces, una por tanda.
  const vistos: string[] = [];
  const unicos = todos.filter((p) => {
    if (vistos.some((v) => mismaApertura(v, p.content))) return false;
    vistos.push(p.content);
    return true;
  });
  if (unicos.length < todos.length) {
    console.log(`descartados ${todos.length - unicos.length} posts por repetir apertura`);
  }
  if (unicos.length === 0) return { error: "generation failed, no posts produced" };

  const readMoreUrl = `https://kilowatto.com/a-fondo/${investigacion.slug}`;

  // One distinct image per post -- never a shared cover -- always mixing styles
  // per Esteban's 2026-08-21 call. A concurrency cap of 4 keeps a 30-post batch's
  // wall time reasonable (sequential Gemini/SDXL calls would take several
  // minutes) without hammering the image APIs harder than proposeImage's own
  // single-topic usage elsewhere ever does.
  const stylesUsed = unicos.map((_, i) => styleOverride?.[i % styleOverride.length] ?? DEFAULT_STYLE_ROTATION[i % DEFAULT_STYLE_ROTATION.length]);
  const images = await withConcurrency(unicos, 4, (p, i) => proposeImage(investigacion.title, p.content, undefined, stylesUsed[i]));

  // One slot per post via the same learned scheduler used for manual approvals --
  // this naturally spreads posts across future days (it never double-books past each
  // platform's daily cap) and keeps every hour within real business hours, tuning
  // itself the same way as the rest of the pipeline instead of a separate hand-rolled
  // random-jitter spread.
  const reserved = new Map<string, number>();
  const inserted: any[] = [];
  for (let i = 0; i < unicos.length; i++) {
    const p = unicos[i];
    const scheduledFor = await assignSmartSchedule(p.platform, reserved);

    // Insert with the plain URL first, then rewrite with the short link: createShortLink needs
    // the post id so a click can be attributed back to the post that earned it, and the id does
    // not exist until the row does. Esteban's call 2026-08-23: every link to his own work goes
    // through kilowatto.com/r/, which keeps the click in our own D1 -- /r/[slug] already records
    // IP, ASN, city, agent and referrer -- and on X a post carrying a URL costs $0.20 against
    // $0.015 without one, so a link had better be worth its price.
    const res = await env.DB.prepare(
      `INSERT INTO brand_posts (platform, kind, investigacion_id, language, content, status, hashtags, source_url, image_r2_key, image_style, scheduled_for)
       VALUES (?, 'investigacion_highlight', ?, 'es', ?, 'pending_approval', ?, ?, ?, ?, ?)`
    )
      .bind(p.platform, investigacionId, p.content, (p.hashtags ?? []).join(" ") || null, readMoreUrl, images[i] ?? null, images[i] ? stylesUsed[i] : null, scheduledFor)
      .run();
    const postId = res.meta.last_row_id as number;

    let shortUrl = readMoreUrl;
    try {
      shortUrl = await createShortLink(readMoreUrl, postId);
    } catch {
      // A failed short link must not cost the post; the full URL still works.
    }
    const content = `${p.content}\n\n${pieDeEnlace(p.platform, idiomaDe(p.content), "investigacion")} ${shortUrl}`;
    await env.DB.prepare("UPDATE brand_posts SET content = ?, source_url = ? WHERE id = ?")
      .bind(content, shortUrl, postId)
      .run();

    inserted.push({ id: postId, platform: p.platform, scheduledFor, hasImage: !!images[i] });
  }

  return { ok: true, investigacion: investigacion.title, count: inserted.length, withImage: inserted.filter((x) => x.hasImage).length, inserted };
}

export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const id = Number(params.id);
  const body = await request.json<{ count?: number; styles?: ImageStyle[] }>().catch(() => ({}) as any);
  const validStyles: ImageStyle[] = ["illustration", "infographic", "real_photo", "photorealistic"];
  const styles = Array.isArray(body?.styles) && body.styles.every((s) => validStyles.includes(s)) ? body.styles : undefined;
  const result = await runGeneratePosts(id, body?.count && body.count > 0 ? body.count : 30, styles);
  const status = "error" in result ? 400 : 200;
  return new Response(JSON.stringify(result), { status, headers: { "content-type": "application/json" } });
};

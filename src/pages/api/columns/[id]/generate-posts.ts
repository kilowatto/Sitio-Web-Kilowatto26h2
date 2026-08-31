import type { APIRoute } from "astro";
import { bloqueDeReglas, revisarPost, mismaApertura, pieDeEnlace, idiomaDe, MAX_CHARS } from "../../../../lib/post-reglas";
import { env } from "cloudflare:workers";
import { buildVoiceContext, voicePromptBlock } from "../../../../lib/brand-voice";
import { proposeImage, type ImageStyle } from "../../../../lib/brand-image";
import { assignSmartSchedule } from "../../../../lib/post-scheduler";
import { createShortLink } from "../../../../lib/short-links";

export const prerender = false;

// Announces a published column. Mirrors investigaciones/[id]/generate-posts.ts, which had been
// the only content type the brand system knew how to talk about -- 20 published columns had
// never produced a single post.
//
// Three deliberate differences from the investigación version:
//
//   1. FOUR posts, not thirty. An investigación has twenty sections and a dozen verified
//      datasets, so thirty angles are really in there. A column is one argument; asking for
//      thirty would produce twenty-six restatements of the same idea.
//   2. No sources block. Columns have no investigacion_sources equivalent, and the number guard
//      below leans on the body text instead.
//   3. The link is SHORTENED. Esteban's call (2026-08-23): every link to his own work goes
//      through kilowatto.com/r/ so the click lands in our D1 -- and on X a post carrying a URL
//      costs $0.20 against $0.015 without one, so the short link also has to be worth its price.

const DEFAULT_STYLE_ROTATION: ImageStyle[] = ["infographic", "illustration", "photorealistic"];
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
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

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

async function generateBatch(
  platform: "x" | "linkedin",
  count: number,
  column: any,
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

Ya publiqué esta columna en kilowatto.com/columnas: "${column.title}"
${column.subtitle ? `Bajada: ${column.subtitle}` : ""}

Texto de la columna (usa SOLO información que aparezca aquí -- no inventes cifras ni datos nuevos):
${bodyPlain}

Plataforma: ${platform}.\n${bloqueDeReglas(platform, idioma)}
Idioma: español.

Genera EXACTAMENTE ${pedidos} posts DISTINTOS entre sí. Una columna defiende UNA idea, así que no busques ${count} datos distintos: busca ${count} ENTRADAS distintas a la misma idea -- la afirmación central, el ejemplo que la ilustra, la objeción que responde, la consecuencia práctica. No repitas el mismo gancho dos veces.

Están pensados para repartirse a lo largo de varias semanas, no todos el mismo día. NO incluyas ningún link en "content" -- se agrega aparte automáticamente. NO incluyas hashtags dentro de "content", van solo en "hashtags" (máximo ${platform === "x" ? 2 : 3}, contextuales, nunca genéricos).

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

export async function runGenerateColumnPosts(columnId: number, count = 4, styleOverride?: ImageStyle[]) {
  const column = await env.DB.prepare("SELECT * FROM columns WHERE id = ? AND status = 'published'")
    .bind(columnId)
    .first<any>();
  if (!column) return { error: "columna no encontrada o no está publicada" };

  const bodyPlain = htmlToPlain(column.body_html, 6000);
  const { voiceSamples, bioFacts, columnVoiceSamples, investigacionSamples } = await buildVoiceContext(env.DB);
  const voiceBlock = voicePromptBlock(voiceSamples, bioFacts, columnVoiceSamples, investigacionSamples);

  const xCount = Math.ceil(count / 2);
  const linkedinCount = count - xCount;

  // Español e inglés alternando: dos tandas por plataforma, intercaladas después para que el
  // feed alterne en vez de publicar una racha entera en un idioma y luego otra en el otro.
  const [xEs, xEn, liEs, liEn] = await Promise.all([
    generateBatch("x", Math.ceil(xCount / 2), column, bodyPlain, voiceBlock, "es"),
    generateBatch("x", Math.floor(xCount / 2), column, bodyPlain, voiceBlock, "en"),
    generateBatch("linkedin", Math.ceil(linkedinCount / 2), column, bodyPlain, voiceBlock, "es"),
    generateBatch("linkedin", Math.floor(linkedinCount / 2), column, bodyPlain, voiceBlock, "en"),
  ]);

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

  const targetUrl = `https://kilowatto.com/columnas/${column.slug}`;
  const stylesUsed = unicos.map(
    (_, i) => styleOverride?.[i % styleOverride.length] ?? DEFAULT_STYLE_ROTATION[i % DEFAULT_STYLE_ROTATION.length]
  );
  // La infografía cuadrada primero, la imagen generada solo para lo que sobre.
  //
  // Decisión de Esteban: reusar el material de la propia pieza en vez de generar una imagen por
  // post. Una gráfica de tres barras da tres infografías, cada una con una cifra real de la
  // columna -- eso cubre los primeros posts con el dato verdadero y sale gratis. Los demás caen
  // al generador de siempre.
  const infografias = await env.MEDIA.list({ prefix: `media/infografias/columna-${columnId}-` })
    .then((r: any) => (r.objects ?? []).map((o: any) => o.key).sort())
    .catch(() => [] as string[]);

  // proposeImage devuelve la CLAVE como cadena, no un objeto: la infografía se devuelve igual.
  const images = await withConcurrency(unicos, 4, async (p, i) =>
    i < infografias.length ? infografias[i] : proposeImage(column.title, p.content, undefined, stylesUsed[i])
  );

  const reserved = new Map<string, number>();
  const inserted: any[] = [];
  for (let i = 0; i < unicos.length; i++) {
    const p = unicos[i];
    const scheduledFor = await assignSmartSchedule(p.platform, reserved);

    // Insert first with the plain URL, then rewrite with the short link: createShortLink wants
    // the post id so a click can be attributed back to the post that earned it, and the id does
    // not exist until the row does.
    const res = await env.DB.prepare(
      `INSERT INTO brand_posts (platform, kind, column_id, language, content, status, hashtags, source_url, image_r2_key, image_style, scheduled_for)
       VALUES (?, 'columna_highlight', ?, 'es', ?, 'pending_approval', ?, ?, ?, ?, ?)`
    )
      .bind(
        p.platform,
        columnId,
        p.content,
        (p.hashtags ?? []).join(" ") || null,
        targetUrl,
        images[i] ?? null,
        images[i] ? (i < infografias.length ? "infographic" : stylesUsed[i]) : null,
        scheduledFor
      )
      .run();
    const postId = res.meta.last_row_id as number;

    let shortUrl = targetUrl;
    try {
      shortUrl = await createShortLink(targetUrl, postId);
    } catch {
      // A failed short link must not cost the post. The full URL still works and still
      // attributes through page_views, it just does not capture the click itself.
    }
    const content =
      p.platform === "x"
        ? `${p.content}\n\n${pieDeEnlace("x", idiomaDe(p.content), "columna")} ${shortUrl}`
        : `${p.content}\n\n${pieDeEnlace("linkedin", idiomaDe(p.content), "columna")} ${shortUrl}`;
    await env.DB.prepare("UPDATE brand_posts SET content = ?, source_url = ? WHERE id = ?")
      .bind(content, shortUrl, postId)
      .run();

    inserted.push({ id: postId, platform: p.platform, scheduledFor, hasImage: !!images[i], shortUrl });
  }

  return {
    ok: true,
    column: column.title,
    count: inserted.length,
    withImage: inserted.filter((x) => x.hasImage).length,
    inserted,
  };
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
  const result = await runGenerateColumnPosts(id, body?.count && body.count > 0 ? body.count : 4, styles);
  return new Response(JSON.stringify(result), {
    status: "error" in result ? 400 : 200,
    headers: { "content-type": "application/json" },
  });
};

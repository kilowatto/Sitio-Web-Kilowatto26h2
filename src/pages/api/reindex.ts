import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { stripHtml } from "../../lib/html-text";

export const prerender = false;

// Must stay in sync with chat.ts's EMBEDDING_MODEL -- see the comment there for why this
// switched from bge-base-en-v1.5 (English-only) to bge-m3 (multilingual) on 2026-08-22, and
// with the VECTORIZE binding's index dimensions (1024 for bge-m3).
const EMBEDDING_MODEL = "@cf/baai/bge-m3";

type Chunk = { id: string; text: string; metadata: Record<string, unknown> };

// One chunk per H2 section (not one giant blob per column) — the embedding model has a limited
// context window, and a whole 4-9k char column would get silently truncated, losing everything
// past the first section. Splitting lets Larry retrieve (and cite) the specific relevant part
// of a column instead of just knowing the column exists.
function splitColumnIntoSections(bodyHtml: string): Array<{ heading: string; text: string }> {
  const parts = bodyHtml.split(/<h2>([\s\S]*?)<\/h2>/);
  // parts alternates: [introHtml, h2Text, sectionHtml, h2Text, sectionHtml, ...]
  const sections: Array<{ heading: string; text: string }> = [];
  const intro = stripHtml(parts[0] ?? "").trim();
  if (intro) sections.push({ heading: "Introducción", text: intro });
  for (let i = 1; i < parts.length; i += 2) {
    const heading = stripHtml(parts[i] ?? "").trim();
    const text = stripHtml(parts[i + 1] ?? "").trim();
    if (text) sections.push({ heading: heading || "Sección", text });
  }
  return sections;
}

async function buildChunks(): Promise<Chunk[]> {
  const chunks: Chunk[] = [];

  const profile = await env.DB.prepare("SELECT * FROM profile WHERE id = 1").first<any>();
  if (profile) {
    chunks.push({
      id: "profile:1",
      text: `${profile.display_name} (${profile.nickname}). Nacido ${profile.birth_date} en ${profile.birth_place}. ${profile.bio_short}`,
      metadata: { entity_type: "profile", entity_id: 1 },
    });
  }

  const { results: companies } = await env.DB.prepare("SELECT * FROM companies ORDER BY sort_order").all<any>();
  for (const c of companies ?? []) {
    chunks.push({
      id: `company:${c.id}`,
      text: `${c.name}${c.role ? ` — ${c.role}` : ""} (${c.start_date ?? ""}${c.end_date ? `-${c.end_date}` : c.is_current ? "-presente" : ""}). ${c.summary ?? ""}`,
      metadata: { entity_type: "company", entity_id: c.id, slug: c.slug },
    });
  }

  const { results: investments } = await env.DB.prepare("SELECT * FROM investments ORDER BY sort_order").all<any>();
  for (const i of investments ?? []) {
    chunks.push({
      id: `investment:${i.id}`,
      text: `Inversión de Orange Rhino: ${i.name} (${i.category}). ${i.summary ?? ""}`,
      metadata: { entity_type: "investment", entity_id: i.id, slug: i.slug },
    });
  }

  const { results: timeline } = await env.DB.prepare("SELECT * FROM timeline_events ORDER BY event_date").all<any>();
  for (const t of timeline ?? []) {
    chunks.push({
      id: `timeline:${t.id}`,
      text: `${t.event_date}: ${t.title}. ${t.description ?? ""}`,
      metadata: { entity_type: "timeline_event", entity_id: t.id },
    });
  }

  const { results: quotes } = await env.DB.prepare("SELECT * FROM quotes ORDER BY sort_order").all<any>();
  for (const q of quotes ?? []) {
    chunks.push({
      id: `quote:${q.id}`,
      text: `Esteban Rey, sobre ${q.category}: "${q.text}"`,
      metadata: { entity_type: "quote", entity_id: q.id },
    });
  }

  const { results: columns } = await env.DB.prepare("SELECT * FROM columns ORDER BY published_at DESC").all<any>();
  for (const col of columns ?? []) {
    const sections = splitColumnIntoSections(col.body_html);
    sections.forEach((s, i) => {
      chunks.push({
        id: `column:${col.id}:${i}`,
        text: `Columna de Esteban Rey (Kilowatto), "${col.title}"${col.subtitle ? ` — ${col.subtitle}` : ""} (${col.published_at}). Sección "${s.heading}": ${s.text}`,
        metadata: { entity_type: "column", entity_id: col.id, slug: col.slug, section: s.heading },
      });
    });
  }

  // Larry has to KNOW a narrated version exists, or he'll tell a reader there isn't one. One
  // chunk per narrated piece, phrased so a question like "¿lo puedo escuchar?" or "¿tienes
  // audio?" retrieves it, and carrying the real URL so he can hand it over instead of
  // describing it vaguely.
  const { results: audioAssets } = await env.DB.prepare(
    `SELECT ma.entity_type, ma.entity_id, ma.locale, ma.r2_key, ma.duration_s,
            COALESCE(c.title, i.title) AS title,
            COALESCE(c.slug, i.slug) AS slug
       FROM media_assets ma
       LEFT JOIN columns c        ON ma.entity_type = 'columna'       AND c.id = ma.entity_id
       LEFT JOIN investigaciones i ON ma.entity_type = 'investigacion' AND i.id = ma.entity_id
      WHERE ma.kind = 'audio_narration' AND ma.status = 'ready' AND ma.r2_key IS NOT NULL`
  ).all<any>();

  for (const a of audioAssets ?? []) {
    if (!a.title || !a.slug) continue;
    const minutes = a.duration_s ? Math.round(a.duration_s / 60) : null;
    const kind = a.entity_type === "columna" ? "columna" : "investigación";
    const pageUrl = a.entity_type === "columna"
      ? `https://kilowatto.com/columnas/${a.slug}`
      : `https://kilowatto.com/a-fondo/${a.slug}`;
    chunks.push({
      id: `audio:${a.entity_type}:${a.entity_id}:${a.locale}`,
      text:
        `La ${kind} "${a.title}" tiene versión en AUDIO narrada, se puede escuchar, ` +
        `tiene podcast, tiene narración hablada${minutes ? ` de aproximadamente ${minutes} minutos` : ""}. ` +
        `El reproductor está arriba del texto en ${pageUrl}. ` +
        `La narración usa la voz sintética de Larry, no es una grabación humana.`,
      metadata: {
        entity_type: "audio",
        entity_id: a.entity_id,
        slug: a.slug,
        section: "Versión en audio",
      },
    });
  }

  // Same per-H2-section chunking as columns, plus the executive summary as its own chunk --
  // an investigación is long enough (often 6000-9000+ words) that a reader question is much
  // more likely to land on one specific section than the piece as a whole.
  const { results: investigaciones } = await env.DB.prepare("SELECT * FROM investigaciones WHERE status = 'published' ORDER BY published_at DESC").all<any>();
  for (const inv of investigaciones ?? []) {
    chunks.push({
      id: `investigacion:${inv.id}:summary`,
      text: `Investigación de A Fondo con Kilowatto, "${inv.title}"${inv.subtitle ? ` — ${inv.subtitle}` : ""} (${inv.published_at}). Resumen ejecutivo: ${stripHtml(inv.summary)}`,
      metadata: { entity_type: "investigacion", entity_id: inv.id, slug: inv.slug, section: "Resumen ejecutivo" },
    });
    const sections = splitColumnIntoSections(inv.body_html.replace(/<!--chart:[a-z0-9-]+-->/g, "").replace(/<figure class="ia-inline-img[\s\S]*?<\/figure>/g, ""));
    sections.forEach((s, i) => {
      chunks.push({
        id: `investigacion:${inv.id}:${i}`,
        text: `Investigación de A Fondo con Kilowatto, "${inv.title}" (${inv.published_at}). Sección "${s.heading}": ${s.text}`,
        metadata: { entity_type: "investigacion", entity_id: inv.id, slug: inv.slug, section: s.heading },
      });
    });
  }

  // Press mentions, from /prensa (press_mentions, status='published') — Esteban was asked
  // "¿qué dicen de ti en la prensa?" style questions and Larry had never been given this table
  // at all, confirmed live 2026-08-22 while auditing every page against what Larry actually
  // knows (comida.astro was the piece that started the audit -- see below).
  const { results: pressMentions } = await env.DB.prepare(
    "SELECT * FROM press_mentions WHERE status = 'published' ORDER BY published_at DESC"
  ).all<any>();
  for (const p of pressMentions ?? []) {
    chunks.push({
      id: `press:${p.id}`,
      text: `Mención de prensa sobre Esteban Rey (Kilowatto) en ${p.outlet ?? "un medio"} (${p.published_at ?? "fecha desconocida"}): "${p.title}". ${p.summary ?? ""}`,
      metadata: { entity_type: "press_mention", entity_id: p.id, url: p.url },
    });
  }

  // Projects ("Mis proyectos", self-refreshing directory distinct from the `companies`
  // timeline) — Ignia Cloud, Yucatech Festival, Frida Café, Cereza, Vectron, etc. Only
  // is_reachable=1 ones, matching what the public /empresas page itself shows.
  const { results: projects } = await env.DB.prepare(
    "SELECT * FROM projects WHERE is_reachable = 1 ORDER BY sort_order"
  ).all<any>();
  for (const p of projects ?? []) {
    chunks.push({
      id: `project:${p.id}`,
      text: `Proyecto de Esteban Rey: ${p.name}${p.role ? ` (${p.role})` : ""}. ${p.summary ?? ""} URL: ${p.url}`,
      metadata: { entity_type: "project", entity_id: p.id, slug: p.slug },
    });
  }

  // Books ("La biblioteca de Kilowatto", /biblioteca) — one chunk per owned book (title,
  // author, genre, why it's there) plus one rollup stats chunk so a broad question ("¿cuántos
  // libros tienes?") doesn't need 60 retrieved chunks to answer.
  const { results: books } = await env.DB.prepare(
    "SELECT * FROM books WHERE status = 'tengo' ORDER BY sort_order"
  ).all<any>();
  for (const b of books ?? []) {
    chunks.push({
      id: `book:${b.id}`,
      text: `Esteban Rey tiene el libro "${b.title}", de ${b.author}${b.genre ? ` (${b.genre})` : ""}, en su biblioteca física. ${b.summary ?? ""}`,
      metadata: { entity_type: "book", entity_id: b.id },
    });
  }
  if ((books ?? []).length > 0) {
    const authorCounts = new Map<string, number>();
    for (const b of books ?? []) authorCounts.set(b.author, (authorCounts.get(b.author) ?? 0) + 1);
    const topAuthor = [...authorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    chunks.push({
      id: "books:stats",
      text: `La biblioteca física de Esteban Rey tiene ${(books ?? []).length} libros catalogados en kilowatto.com/biblioteca. El autor con más libros es ${topAuthor[0]} (${topAuthor[1]} títulos) — sobre todo el Riordanverse (Percy Jackson, Héroes del Olimpo, Magnus Chase, Las Pruebas de Apolo).`,
      metadata: { entity_type: "books_stats" },
    });
  }

  const { results: bookQuotes } = await env.DB.prepare(
    "SELECT bq.*, b.title AS book_title FROM book_quotes bq LEFT JOIN books b ON b.id = bq.book_id ORDER BY bq.sort_order"
  ).all<any>();
  for (const q of bookQuotes ?? []) {
    chunks.push({
      id: `book_quote:${q.id}`,
      text: `Cita del libro "${q.book_title ?? q.attributed_to ?? ""}": "${q.quote_text}"`,
      metadata: { entity_type: "book_quote", entity_id: q.id },
    });
  }

  // Food ("Mi comida favorita", /comida) — hardcoded page, not in D1, same reasoning as the
  // pets below: mirrored here by hand so Larry can actually answer "¿cuál es tu comida
  // favorita?" instead of saying "no sé" despite a whole page about it. Confirmed live
  // 2026-08-22 that this exact gap was why Larry didn't know Esteban's favorite dish.
  chunks.push({
    id: "food:favorito",
    text: 'El platillo favorito de Esteban Rey, sin pensarlo mucho, es nigiri de salmón con un toque de wasabi -- simple y directo. También es fan de los poke bowls con arroz de coliflor, salmón, atún, elote y edamame. Su restaurante de sushi de cadena favorito en México es El Japonez (sobre todo el rollo con mantequilla de trufa); también es fan de Sushi Ran en Sausalito, California, y de Kunio en San Ángel, Ciudad de México.',
    metadata: { entity_type: "food", entity_id: "favorito" },
  });
  chunks.push({
    id: "food:pastor",
    text: "Esteban Rey come tacos al pastor en El Farolito, en la Ciudad de México (sucursales de la Condesa, Insurgentes o el Pedregal) -- parada obligada para la familia y los amigos en cuanto se bajan del avión.",
    metadata: { entity_type: "food", entity_id: "pastor" },
  });
  chunks.push({
    id: "food:amashito",
    text: "El chile amashito es uno de los antojos favoritos de Esteban Rey: un chile silvestre pequeño y redondo, típico del sureste de México (Tabasco y Chiapas), primo cercano del chiltepín. Se come fresco y verde, nunca seco, picado con cebolla morada y limón.",
    metadata: { entity_type: "food", entity_id: "amashito" },
  });
  chunks.push({
    id: "food:marquesitas",
    text: "Las marquesitas son una crepa delgada y crujiente de la cocina callejera del sureste de México, cocida en un molde circular de hierro caliente y rellena típicamente con queso de bola holandés y cajeta -- otro de los antojos que aparecen en la página de comida de Esteban Rey.",
    metadata: { entity_type: "food", entity_id: "marquesitas" },
  });
  chunks.push({
    id: "food:paella",
    text: 'Esteban Rey tiene toda una sección sobre el arroz a la paella en kilowatto.com/comida, con once tipos (valenciana, de conejo de monte, de marisco, mixta, arroz negro, a banda, de bogavante, de verduras, de pato, al horno, meloso/caldoso) y recetas incluidas. Aclara que "paella" es, en rigor, el nombre del sartén (del latín patella, "sartén pequeño", vía el valenciano) y no del platillo, que se llama arroz a la paella.',
    metadata: { entity_type: "food", entity_id: "paella" },
  });

  // Tech stack ("Detrás de cámaras", /stack) — hardcoded page, same hand-mirror reasoning.
  chunks.push({
    id: "stack:cloudflare",
    text: "kilowatto.com está diseñado y orquestado por Ignia Cloud, pero corre 100% sobre Cloudflare: Workers (cómputo, sirve cada página y API, y el chat de Larry), D1 (base de datos), R2 (fotos, sin cargos de salida), Vectorize (búsqueda semántica, el cerebro de Larry), Workers AI (texto, traducciones, descripciones de fotos, moderación), KV (caché) y Cron Triggers (revisión automática de prensa cada 6 horas).",
    metadata: { entity_type: "stack", entity_id: "cloudflare" },
  });

  // Yucatech Festival exact facts (already summarized in the `projects` chunk above, but this
  // adds the precise date/venue/speaker/winner details from /yucatech's own FAQ).
  chunks.push({
    id: "yucatech:facts",
    text: 'El Yucatech Festival, fundado y financiado por Esteban Rey de su propio bolsillo (sin fines de lucro), tuvo su primera edición el 16 de abril de 2026 en el Centro Internacional de Congresos de Yucatán, en Mérida -- con más de 500 asistentes y ponentes como Uri Levine, cofundador de Waze. La startup ganadora de la "Elevator Pitch Hour" (con capital real detrás de cada pitch) fue Creare Ride. Se realiza cada año.',
    metadata: { entity_type: "event", entity_id: "yucatech" },
  });

  // Pets, from /avestruces — not in D1 (it's a hardcoded static page), so mirrored here by hand
  // so Larry actually knows and loves them, not just the humans/companies.
  chunks.push({
    id: "pets:luke-leia",
    text: "Esteban tiene dos avestruces mascota, Luke y Leia (nombres de Star Wars), que llegaron de una granja de Mérida a los 2 meses de edad y hoy son gigantes. Son extremadamente sociables, metiches y les encanta la fiesta — se acercan a investigar visitas, cámaras y cualquier cosa que se mueva. Luke se cree el gerente de seguridad del terreno y tiene debilidad por objetos brillantes como lentes de sol y llaves de coche. Leia es la fiestera oficial, aparece corriendo en cuanto hay música o gente riendo. Un avestruz puede vivir 30-40 años, así que aunque ya son enormes, apenas son unos bebés.",
    metadata: { entity_type: "pet", entity_id: "luke-leia" },
  });
  chunks.push({
    id: "pets:yoda",
    text: 'Yoda es un chapulín/langosta gigante (probablemente Tropidacris cristata) que vive en el terreno de Esteban y es amigo de las avestruces Luke y Leia. Le pusieron ese nombre por su tamaño descomunal, su tono verde-amarillo y la calma con la que se deja cargar en la mano.',
    metadata: { entity_type: "pet", entity_id: "yoda" },
  });
  chunks.push({
    id: "pets:red-leader",
    text: 'Red Leader y Red Two son un par de caracaras crestados (rapaces, comúnmente confundidas con águilas) que se paran casi a diario en la misma rama seca del terreno de Esteban, cerca de donde viven las avestruces Luke y Leia. Los nombres son de escuadrón, porque siempre vuelan en formación de dos.',
    metadata: { entity_type: "pet", entity_id: "red-leader" },
  });
  chunks.push({
    id: "pets:buffalos",
    text: "Esteban también tiene búfalos de agua en el terreno, llamados Ezra, Zeb, Sabine y Hera (nombres de una tripulación rebelde). Viven cerca de las avestruces Luke y Leia. La manada acaba de crecer: Hera tuvo una cría, un ternero sano llamado Jacen, como el hijo que Hera Syndulla tiene en el canon de Star Wars Rebels.",
    metadata: { entity_type: "pet", entity_id: "buffalos" },
  });
  chunks.push({
    id: "pets:qui-gon",
    text: "Qui-Gon Jinn es un mono aullador negro o saraguato yucateco (Alouatta pigra) que empezó a aparecer entre los árboles más altos del terreno de Esteban, cerca de donde viven las avestruces Luke y Leia. Le pusieron ese nombre por lo sereno y tranquilo que se ve en lo alto del árbol, como el Jedi. Antes de verlo ya se escuchaba: el aullido de un mono aullador se oye a uno o dos kilómetros de distancia.",
    metadata: { entity_type: "pet", entity_id: "qui-gon" },
  });
  chunks.push({
    id: "pets:plo-koon",
    text: "El maestro Plo Koon es un mapache norteño (Procyon lotor) que se pasa el día escondido e inmóvil en los árboles más altos del terreno de Esteban, sobre donde viven las avestruces Luke y Leia, y baja de noche a buscar comida. Le pusieron ese nombre porque, como el Jedi Kel Dor, nunca se quita el antifaz — en su caso, la máscara negra alrededor de los ojos típica del mapache.",
    metadata: { entity_type: "pet", entity_id: "plo-koon" },
  });

  return chunks;
}

// Exported so approve.ts (columns and investigaciones) can trigger a reindex in-process right
// after publishing -- until 2026-08-21 NOTHING on the site did this automatically anywhere;
// Larry only ever learned about new content when someone remembered to hit this endpoint by
// hand. Full rebuild every time (not incremental) is intentional, matching how this endpoint
// already worked -- simpler and still fast enough at this content volume.
// Vectorize hard-caps a vector's metadata at 10240 bytes of compact JSON. chat.ts pulls
// metadata.text straight into Larry's prompt context (see api/chat.ts's topK=5 query) --
// column/investigación sections can run several thousand words, so storing the FULL text
// both blew that cap (confirmed live 2026-08-22: "investigacion:1:0" alone was 26846 bytes,
// which fails env.VECTORIZE.upsert() for the ENTIRE batch, not just that one vector -- likely
// why nothing had actually reindexed successfully in a while) and would have made every
// chat context absurdly long anyway. The embedding itself still runs on the FULL text for
// accurate retrieval; only the stored preview is capped.
const MAX_METADATA_TEXT = 1200;
function truncateForMetadata(text: string): string {
  return text.length > MAX_METADATA_TEXT ? text.slice(0, MAX_METADATA_TEXT) + "…" : text;
}

export async function runReindex(): Promise<{ indexed: number }> {
  const chunks = await buildChunks();

  // Concurrency-capped, not sequential -- press/books/projects/food additions on 2026-08-22
  // pushed the chunk count well past 300, and one-embedding-call-at-a-time was needlessly
  // slow at that volume. Same worker-pool shape already used elsewhere in this codebase
  // (generate-posts.ts, translateSectionsBatched) for bulk AI calls.
  const CONCURRENCY = 8;
  const vectors = new Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>(chunks.length);
  let next = 0;
  async function worker() {
    while (next < chunks.length) {
      const i = next++;
      const chunk = chunks[i];
      const embedding = await env.AI.run(EMBEDDING_MODEL, { text: [chunk.text] });
      vectors[i] = { id: chunk.id, values: embedding.data[0], metadata: { ...chunk.metadata, text: truncateForMetadata(chunk.text) } };
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker));

  if (vectors.length > 0) {
    await env.VECTORIZE.upsert(vectors);
  }

  if (env?.KILOWATTO_KV) {
    await env.KILOWATTO_KV.put("last_reindex_at", new Date().toISOString());
  }

  return { indexed: vectors.length };
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const result = await runReindex();
  return new Response(JSON.stringify({ indexed: result.indexed }), {
    headers: { "content-type": "application/json" },
  });
};

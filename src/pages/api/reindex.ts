import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { stripHtml } from "../../lib/html-text";

export const prerender = false;

const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

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
export async function runReindex(): Promise<{ indexed: number }> {
  const chunks = await buildChunks();
  const vectors = [];

  for (const chunk of chunks) {
    const embedding = await env.AI.run(EMBEDDING_MODEL, { text: [chunk.text] });
    const values = embedding.data[0];
    vectors.push({ id: chunk.id, values, metadata: { ...chunk.metadata, text: chunk.text } });
  }

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
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const result = await runReindex();
  return new Response(JSON.stringify({ indexed: result.indexed }), {
    headers: { "content-type": "application/json" },
  });
};

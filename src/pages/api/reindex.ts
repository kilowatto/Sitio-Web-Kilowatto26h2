import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

type Chunk = { id: string; text: string; metadata: Record<string, unknown> };

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

  const { results: family } = await env.DB.prepare(
    "SELECT * FROM family_members ORDER BY sort_order"
  ).all<any>();
  for (const f of family ?? []) {
    // Privacy: never index anything about Esteban's children/spouse composition — only ancestors/siblings/business-relevant facts.
    chunks.push({
      id: `family:${f.id}`,
      text: `${f.full_name}${f.nickname ? ` ("${f.nickname}")` : ""} — ${f.relationship} de Esteban Rey. ${f.bio ?? ""}`,
      metadata: { entity_type: "family_member", entity_id: f.id, slug: f.slug },
    });
  }

  return chunks;
}

export const POST: APIRoute = async () => {
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

  return new Response(JSON.stringify({ indexed: vectors.length }), {
    headers: { "content-type": "application/json" },
  });
};

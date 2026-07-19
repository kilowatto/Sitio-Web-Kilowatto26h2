import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

async function wikidataSearch(name: string, lang = "es") {
  const searchRes = await fetch(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=${lang}&format=json&limit=1`,
    { headers: { "User-Agent": "kilowatto.com entity-tooltips (esteban.rey@desici.com)" } }
  );
  const searchData: any = await searchRes.json();
  const id = searchData?.search?.[0]?.id;
  if (!id) return null;

  const entityRes = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, {
    headers: { "User-Agent": "kilowatto.com entity-tooltips (esteban.rey@desici.com)" },
  });
  const entityData: any = await entityRes.json();
  const entity = entityData?.entities?.[id];
  if (!entity) return null;

  const description = entity.descriptions?.[lang]?.value ?? entity.descriptions?.en?.value ?? null;
  const officialSite = entity.claims?.P856?.[0]?.mainsnak?.datavalue?.value ?? null;
  const imageFile = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null;
  const imageUrl = imageFile
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}?width=400`
    : null;
  const wikipediaUrl = entityData.entities[id].sitelinks?.[`${lang}wiki`]?.title
    ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(entityData.entities[id].sitelinks[`${lang}wiki`].title)}`
    : null;

  return {
    description,
    imageUrl,
    linkUrl: officialSite ?? wikipediaUrl,
    linkType: officialSite ? "official" : "wikipedia",
  };
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json<{ name: string; entity_type?: string; internal_path?: string }>();
  if (!body?.name) {
    return new Response(JSON.stringify({ error: "missing name" }), { status: 400 });
  }

  // Family members and other private people never go through Wikidata — internal-only link.
  if (body.internal_path) {
    await env.DB.prepare(
      `INSERT INTO entities (name, entity_type, description, link_url, link_type, internal_path, source, approval_status)
       VALUES (?, ?, NULL, NULL, 'internal', ?, 'manual', 'pending')
       ON CONFLICT(name) DO UPDATE SET internal_path = excluded.internal_path, link_type = 'internal'`
    )
      .bind(body.name, body.entity_type ?? "person_family", body.internal_path)
      .run();
    return new Response(JSON.stringify({ ok: true, source: "internal" }), {
      headers: { "content-type": "application/json" },
    });
  }

  const found = await wikidataSearch(body.name);
  if (!found) {
    return new Response(JSON.stringify({ error: "not found on Wikidata" }), { status: 404 });
  }

  await env.DB.prepare(
    `INSERT INTO entities (name, entity_type, description, image_url, link_url, link_type, source, approval_status)
     VALUES (?, ?, ?, ?, ?, ?, 'wikidata', 'pending')
     ON CONFLICT(name) DO UPDATE SET description = excluded.description, image_url = excluded.image_url,
       link_url = excluded.link_url, link_type = excluded.link_type, source = 'wikidata'`
  )
    .bind(body.name, body.entity_type ?? "place", found.description, found.imageUrl, found.linkUrl, found.linkType)
    .run();

  return new Response(JSON.stringify({ ok: true, ...found }), {
    headers: { "content-type": "application/json" },
  });
};

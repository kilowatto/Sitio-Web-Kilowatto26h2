import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.name FROM people p
     JOIN photo_people pp ON pp.person_id = p.id
     WHERE pp.photo_id = ? ORDER BY p.name`
  )
    .bind(params.id)
    .all();
  return new Response(JSON.stringify({ people: results ?? [] }), { headers: { "content-type": "application/json" } });
};

export const POST: APIRoute = async ({ params, request }) => {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ name: string }>();
  const name = body?.name?.trim();
  if (!name) return new Response(JSON.stringify({ error: "falta name" }), { status: 400 });

  await env.DB.prepare("INSERT INTO people (name) VALUES (?) ON CONFLICT(name) DO NOTHING").bind(name).run();
  const person = await env.DB.prepare("SELECT id FROM people WHERE name = ?").bind(name).first<any>();
  await env.DB.prepare("INSERT INTO photo_people (photo_id, person_id) VALUES (?, ?) ON CONFLICT DO NOTHING")
    .bind(params.id, person.id)
    .run();

  return new Response(JSON.stringify({ ok: true, personId: person.id, name }), {
    headers: { "content-type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const url = new URL(request.url);
  const personId = url.searchParams.get("personId");
  await env.DB.prepare("DELETE FROM photo_people WHERE photo_id = ? AND person_id = ?").bind(params.id, personId).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

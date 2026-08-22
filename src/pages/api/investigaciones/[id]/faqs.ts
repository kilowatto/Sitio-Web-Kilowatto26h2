import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// GET: list this investigación's current FAQ set (admin edit UI).
export const GET: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const id = Number(params.id);
  const res = await env.DB.prepare(
    "SELECT id, question, answer_html FROM investigacion_faqs WHERE investigacion_id = ? ORDER BY position"
  )
    .bind(id)
    .all<any>();
  return new Response(JSON.stringify({ faqs: res.results ?? [] }), { headers: { "content-type": "application/json" } });
};

// PUT: full replace of the FAQ set from the admin edit UI -- same delete+insert shape as
// runGenerateFaqs, just with admin-supplied text instead of AI output. Old translations tied
// to the previous row ids are left in place but orphaned (harmless, never read again since no
// FAQ with that id exists anymore) -- Esteban can re-run the translate workflow if he wants
// the edited FAQs translated again.
export const PUT: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const id = Number(params.id);
  const body = await request.json<{ faqs?: { question: string; answer: string }[] }>().catch(() => ({}) as any);
  const faqs = (body?.faqs ?? []).filter((f) => f?.question?.trim() && f?.answer?.trim());

  await env.DB.prepare("DELETE FROM investigacion_faqs WHERE investigacion_id = ?").bind(id).run();
  for (let i = 0; i < faqs.length; i++) {
    await env.DB.prepare(
      "INSERT INTO investigacion_faqs (investigacion_id, position, question, answer_html) VALUES (?, ?, ?, ?)"
    )
      .bind(id, i, faqs[i].question.trim(), `<p>${faqs[i].answer.trim()}</p>`)
      .run();
  }
  return new Response(JSON.stringify({ ok: true, count: faqs.length }), { headers: { "content-type": "application/json" } });
};

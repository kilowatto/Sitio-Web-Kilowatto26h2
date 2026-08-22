import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runGenerateFaqs } from "../../../../lib/investigacion-faq";

export const prerender = false;

// Manual re-trigger, same shape as generate-posts.ts's POST route -- lets Esteban
// regenerate the FAQ set by hand (e.g. after editing the body) without re-approving.
export const POST: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const id = Number(params.id);
  const result = await runGenerateFaqs(id);
  const status = "error" in result ? 400 : 200;
  return new Response(JSON.stringify(result), { status, headers: { "content-type": "application/json" } });
};

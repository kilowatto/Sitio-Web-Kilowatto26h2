import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runNarrateDialogue } from "../../../lib/narrate-dialogue";

export const prerender = false;

// POST ?token=&id=3&locale=es-MX[&force=1]
export const POST: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const id = Number(url.searchParams.get("id") ?? 0);
  if (!id) return new Response("id requerido", { status: 400 });

  const result = await runNarrateDialogue(
    id,
    url.searchParams.get("locale") ?? "es-MX",
    url.searchParams.get("force") === "1"
  );
  return Response.json(result, { status: result.ok ? 200 : 500 });
};

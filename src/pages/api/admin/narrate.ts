import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runNarrate } from "../../../lib/narrate";
import type { EntityType } from "../../../lib/audio-script";

export const prerender = false;

// Narrates one piece. Thin token-gated wrapper over runNarrate() so the same logic can be
// called in-process from the publish path.
export const POST: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const type = (url.searchParams.get("type") ?? "") as EntityType;
  const id = Number(url.searchParams.get("id"));
  const locale = url.searchParams.get("locale") ?? "es-MX";
  const force = url.searchParams.get("force") === "1";

  if (type !== "columna" && type !== "investigacion") {
    return new Response(JSON.stringify({ error: "type debe ser columna o investigacion" }), { status: 400 });
  }
  if (!Number.isFinite(id) || id <= 0) {
    return new Response(JSON.stringify({ error: "id inválido" }), { status: 400 });
  }

  const result = await runNarrate(type, id, locale, force);
  return new Response(JSON.stringify(result, null, 2), {
    status: result.ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
};

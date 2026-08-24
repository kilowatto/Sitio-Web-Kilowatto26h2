import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { buildClipProps } from "../../../lib/clip-script";

export const prerender = false;

// Returns the props a Remotion render needs. Costs nothing but Workers AI, so the words can be
// judged before anything is rendered or narrated.
export const GET: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });
  const type = url.searchParams.get("type") === "columna" ? "columna" : "investigacion";
  const id = Number(url.searchParams.get("id") ?? 0);
  if (!id) return new Response("id requerido", { status: 400 });
  const debug = url.searchParams.get("debug") === "1";
  return Response.json(await buildClipProps(type, id, url.searchParams.get("chart") ?? undefined, debug));
};

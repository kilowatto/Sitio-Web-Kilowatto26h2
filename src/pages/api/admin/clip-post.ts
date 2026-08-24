import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runClipPost } from "../../../lib/clip-post";

export const prerender = false;

// Renders a clip and queues it as a post. Unlike /clip-props this one spends money -- ElevenLabs
// for the narration and container time for the render -- so it is POST and one piece at a time.
//
// Nothing here publishes. The rows land as 'pending_approval' like every other post.
export const POST: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });
  const type = url.searchParams.get("type") === "columna" ? "columna" : "investigacion";
  const id = Number(url.searchParams.get("id") ?? 0);
  if (!id) return new Response("id requerido", { status: 400 });
  const videoKey = url.searchParams.get("video");
  const seconds = Number(url.searchParams.get("seconds"));
  const result = await runClipPost(type, id, {
    chartKey: url.searchParams.get("chart") ?? undefined,
    preRendered: videoKey && seconds > 0 ? { videoKey, seconds } : undefined,
  });
  return Response.json(result, { status: result.ok ? 200 : 500 });
};

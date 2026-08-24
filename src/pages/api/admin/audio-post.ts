import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runAudioPost } from "../../../lib/audio-post";

export const prerender = false;

// POST ?token=&type=investigacion&id=1&kind=audio_dialogue
export const POST: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });
  const type = url.searchParams.get("type") === "columna" ? "columna" : "investigacion";
  const id = Number(url.searchParams.get("id") ?? 0);
  const kind = url.searchParams.get("kind") === "audio_narration" ? "audio_narration" : "audio_dialogue";
  if (!id) return new Response("id requerido", { status: 400 });
  return Response.json(await runAudioPost(type, id, kind));
};

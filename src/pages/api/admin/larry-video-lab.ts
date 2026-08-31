import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { inlineFromR2, createVideo, getVideo, storeVideo } from "../../../lib/elevenlabs-video";
import { synthesizeScript, concatChunksToR2 } from "../../../lib/elevenlabs";

export const prerender = false;

// Bench for Larry on camera, before any of it touches the post pipeline.
//
// Same shape as larry-face-lab did for HeyGen and dialogue-lab did for the two-voice format: the
// risky assumption gets tested on its own and cheaply. Here the assumption was that
// creatify-aurora would animate a rhinoceros at all -- HeyGen would only do it with a shortened
// muzzle, and the whole point of this provider is that its docs say "character", not "person".
//
// Verdict (2026-08-30): it doesn't. Tried default settings, audio_guidance_scale up to 4, and a
// tight face-only crop -- zero mouth movement in all three, confirmed frame-by-frame. The
// endpoint's pydantic schema (probed directly by sending deliberately-invalid extra fields) only
// accepts model_id/image/audio/resolution/guidance_scale/audio_guidance_scale for creatify-aurora
// -- no `prompt` field, which is what Creatify's own docs say drives a character performance. The
// model that DOES lip-sync (Flows' "Lipsync Generation" node, OmniHuman/Veed) isn't in this
// endpoint's model_id list at all -- still canvas-only, matching Flows' docs saying API access is
// "planned for a future release". Kept as a bench in case that changes.

function authed(url: URL): boolean {
  const t = url.searchParams.get("token");
  return t === env.ADMIN_TOKEN || t === env.SCRATCH_TOKEN;
}

// GET ?generation=<id> — poll a running generation.
export const GET: APIRoute = async ({ url }) => {
  if (!authed(url)) return new Response("unauthorized", { status: 401 });
  const id = url.searchParams.get("generation");
  if (!id) return new Response("generation requerido", { status: 400 });
  try {
    const status = await getVideo(id);
    // Copy it out immediately: the signed URL expires in about an hour.
    if (status.status === "completed" && status.content_url) {
      const key = `media/video/larry-lab/${id}.mp4`;
      const bytes = await storeVideo(status.content_url, key);
      return Response.json({ ...status, stored: `https://kilowatto.com/media/video/${key}`, bytes });
    }
    return Response.json(status);
  } catch (err: any) {
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
};

// POST { text, imageKey?, model?, audioGuidance?, guidance?, resolution? }
export const POST: APIRoute = async ({ url, request }) => {
  if (!authed(url)) return new Response("unauthorized", { status: 401 });
  const b = await request
    .json<{
      text?: string;
      imageKey?: string;
      model?: string;
      audioGuidance?: number;
      guidance?: number;
      resolution?: "480p" | "720p";
    }>()
    .catch(() => ({}) as any);

  const text = b?.text ?? "Hola, soy Larry. Esto es una prueba de video para Kilowatto.";
  const imageKey = b?.imageKey ?? "media/podcast/cover.jpg";

  try {
    // Larry's own voice, on multilingual_v2 at the settings Esteban signed off on -- NOT v3,
    // which is what made him sound flat in the podcast and is why the podcast got its own host.
    const synth = await synthesizeScript(text);
    const audioKey = `media/audio/larry-lab/${Date.now()}.mp3`;
    await concatChunksToR2(synth.chunks, audioKey);

    // Inline, not uploaded: /v1/assets is Pro-only and this account is Creator.
    const [image, audio] = await Promise.all([
      inlineFromR2(imageKey, "image/jpeg"),
      inlineFromR2(audioKey, "audio/mpeg"),
    ]);

    const created = await createVideo({
      model_id: b?.model ?? "creatify-aurora",
      image,
      audio,
      resolution: b?.resolution ?? "720p",
      ...(typeof b?.audioGuidance === "number" ? { audio_guidance_scale: b.audioGuidance } : {}),
      ...(typeof b?.guidance === "number" ? { guidance_scale: b.guidance } : {}),
    });

    return Response.json({
      generation: created.id,
      status: created.status,
      audio: `https://kilowatto.com/media/video/${audioKey}`,
      poll: `/api/admin/larry-video-lab?generation=${created.id}`,
      charactersBilled: synth.charactersBilled,
    });
  } catch (err: any) {
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
};

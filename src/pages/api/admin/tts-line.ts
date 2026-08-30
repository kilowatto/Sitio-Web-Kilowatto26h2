import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { synthesizeScript, concatChunksToR2 } from "../../../lib/elevenlabs";

export const prerender = false;

// One-off utility: synthesize a single short line as its own standalone mp3 (Larry's voice, same
// settings as every clip) and store it at a given R2 key. Built for the "rapado" clip's two
// Larry-on-camera lines, so Esteban can hand them to ElevenLabs Flows manually (its web canvas
// works today; the programmatic API is still gated -- see the conversation this came from) --
// not part of any pipeline, just a bench tool.
export const POST: APIRoute = async ({ url, request }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ text?: string; key?: string }>().catch(() => ({}) as any);
  if (!body?.text?.trim() || !body?.key?.trim()) {
    return new Response(JSON.stringify({ error: "text y key son obligatorios" }), { status: 400 });
  }
  try {
    const synth = await synthesizeScript(body.text, { stability: 0.35 }, false);
    const bytes = await concatChunksToR2(synth.chunks, body.key);
    return Response.json({ ok: true, key: body.key, bytes, url: `https://kilowatto.com/media/video/${body.key}` });
  } catch (err: any) {
    return Response.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  listOwnVoices,
  searchSharedVoices,
  synthesizeDialogue,
  groupTurns,
  type DialogueTurn,
} from "../../../lib/elevenlabs-dialogue";
import { concatChunksToR2 } from "../../../lib/elevenlabs";

export const prerender = false;

// Bench for the two-voice format, before any of it is wired into the publish pipeline.
//
// Same shape as larry-face-lab: the risky assumption gets tested on its own, cheaply, first.
// Here the assumption is that `eleven_v3` holds up with the CLONED kilowatto voice -- ElevenLabs
// recommends professional clones for v3, and the kilowatto voice was made for
// multilingual_v2. If Larry stops sounding like Larry in v3, the whole format is off the table
// and it is better to learn that from a 90-second sample than from a built pipeline.

function authed(url: URL): boolean {
  const token = url.searchParams.get("token");
  return token === env.ADMIN_TOKEN || token === env.SCRATCH_TOKEN;
}

// GET ?action=voices        -> voices already on the account
// GET ?action=search&...    -> shared-library candidates for the co-host
export const GET: APIRoute = async ({ url }) => {
  if (!authed(url)) return new Response("unauthorized", { status: 401 });

  try {
    const action = url.searchParams.get("action") ?? "voices";
    if (action === "voices") {
      return Response.json({ voices: await listOwnVoices() });
    }
    if (action === "search") {
      const params: Record<string, string> = {};
      for (const k of ["language", "gender", "accent", "age", "use_cases", "search", "page_size"]) {
        const v = url.searchParams.get(k);
        if (v) params[k] = v;
      }
      return Response.json({ voices: await searchSharedVoices(params) });
    }
    return new Response("unknown action", { status: 400 });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
};

// POST { turns:[{speaker,text}], cohostVoiceId, hostVoiceId?, languageCode?, label? }
// Synthesizes a sample and returns its URL. Deliberately takes arbitrary turns so the first
// paid v3 call is ~1,000 characters (~$0.18) rather than a full episode.
export const POST: APIRoute = async ({ url, request }) => {
  if (!authed(url)) return new Response("unauthorized", { status: 401 });

  const body = await request
    .json<{
      turns?: DialogueTurn[];
      hostVoiceId?: string;
      cohostVoiceId?: string;
      languageCode?: string;
      label?: string;
    }>()
    .catch(() => ({}) as any);

  const turns = body?.turns ?? [];
  if (turns.length === 0) return Response.json({ error: "turns required" }, { status: 400 });

  const host = body?.hostVoiceId ?? String((env as any).ELEVENLABS_VOICE_ID ?? "");
  const cohost = body?.cohostVoiceId ?? "";
  if (!host || !cohost) return Response.json({ error: "hostVoiceId and cohostVoiceId required" }, { status: 400 });

  try {
    const started = Date.now();
    const result = await synthesizeDialogue(turns, { host, cohost }, body?.languageCode);
    if (result.chunks.length === 0) {
      return Response.json({ error: "no audio produced", warnings: result.warnings }, { status: 502 });
    }

    // The label is part of the key so two candidate co-hosts don't overwrite each other's
    // sample -- the same mistake the A/B narration variants made once already.
    const safeLabel = (body?.label ?? cohost).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "sample";
    const destKey = `media/audio/dialogue-lab/${safeLabel}.mp3`;
    const bytes = await concatChunksToR2(result.chunks, destKey);

    return Response.json({
      url: `https://kilowatto.com/media/video/${destKey}`,
      bytes,
      groups: groupTurns(turns).length,
      charactersBilled: result.charactersBilled,
      cachedChunks: result.cachedChunks,
      estimatedCostUsd: Number((result.charactersBilled * 0.000184).toFixed(3)),
      warnings: result.warnings,
      elapsedMs: Date.now() - started,
    });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
};

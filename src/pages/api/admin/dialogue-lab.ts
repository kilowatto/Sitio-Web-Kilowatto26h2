import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  listOwnVoices,
  searchSharedVoices,
  synthesizeDialogue,
  groupTurns,
  composeSting,
  synthesizeAnnouncer,
  isMonoMp3,
  STING_KEY,
  type DialogueTurn,
} from "../../../lib/elevenlabs-dialogue";
import { concatChunksToR2 } from "../../../lib/elevenlabs";
import { buildDialogueScript, debugFirstBeat } from "../../../lib/dialogue-script";

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
    // Script generation costs nothing but Workers AI, so it is worth reading the turns before
    // paying ElevenLabs to perform them.
    if (action === "script") {
      const entityId = Number(url.searchParams.get("entityId") ?? 0);
      if (!entityId) return new Response("entityId required", { status: 400 });
      const locale = url.searchParams.get("locale") ?? "es-MX";
      return Response.json(await buildDialogueScript("investigacion", entityId, locale));
    }
    if (action === "script-debug") {
      const entityId = Number(url.searchParams.get("entityId") ?? 0);
      if (!entityId) return new Response("entityId required", { status: 400 });
      return Response.json(await debugFirstBeat(entityId, url.searchParams.get("locale") ?? "es-MX"));
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

  // Intro bench: a music sting plus an announcer line, concatenated the way an episode will
  // assemble them. Separate from the episode path so the show's opening can be iterated for
  // cents instead of regenerating twelve minutes of conversation each time.
  if (url.searchParams.get("action") === "intro") {
    const b = await request
      .json<{ prompt?: string; lengthMs?: number; announcer?: string; voiceId?: string; label?: string; stingKey?: string }>()
      .catch(() => ({}) as any);
    try {
      const stingKey = b?.stingKey ?? STING_KEY;
      let stingBytes = 0;
      if (b?.prompt) {
        stingBytes = (await composeSting(b.prompt, b.lengthMs ?? 6000, stingKey)).bytes;
      } else if (!(await env.MEDIA.head(stingKey))) {
        return Response.json({ error: "no hay sting guardado; manda prompt" }, { status: 400 });
      }
      if (!b?.announcer || !b?.voiceId) return Response.json({ error: "announcer y voiceId requeridos" }, { status: 400 });

      const mono = await isMonoMp3(stingKey);
      if (mono === false) {
        return Response.json({
          error:
            "el sting está en estéreo; concatenado con voces mono el reproductor las acelera al doble. " +
            "Conviértelo offline: ffmpeg -i in.mp3 -ac 1 -ar 44100 -b:a 192k out.mp3",
        }, { status: 409 });
      }

      const annKey = await synthesizeAnnouncer(b.announcer, b.voiceId);
      const label = (b?.label ?? "intro").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
      const destKey = `media/audio/dialogue-lab/${label}.mp3`;
      const bytes = await concatChunksToR2(
        [
          { index: 0, text: "sting", r2Key: stingKey, requestId: null, cached: true },
          { index: 1, text: b.announcer, r2Key: annKey, requestId: null, cached: true },
        ],
        destKey
      );
      return Response.json({ url: `https://kilowatto.com/media/video/${destKey}`, bytes, stingBytes, stingKey });
    } catch (err: any) {
      return Response.json({ error: err?.message ?? "unknown" }, { status: 500 });
    }
  }

  const body = await request
    .json<{
      turns?: DialogueTurn[];
      hostVoiceId?: string;
      cohostVoiceId?: string;
      languageCode?: string;
      label?: string;
      entityId?: number;
      locale?: string;
      stability?: number;
    }>()
    .catch(() => ({}) as any);

  // Either explicit turns (voice bench) or a piece to build them from (full episode).
  let turns = body?.turns ?? [];
  let scriptMeta: any = null;
  if (turns.length === 0 && body?.entityId) {
    const built = await buildDialogueScript("investigacion", Number(body.entityId), body?.locale ?? "es-MX");
    // The bench flattens cold open and body into one file; the real pipeline keeps them apart so
    // the ident can sit between them.
    turns = [...built.coldOpen, ...built.turns];
    scriptMeta = {
      beats: built.beats,
      topic: built.topic,
      coldOpenTurns: built.coldOpen.length,
      characters: built.characters,
      estimatedMinutes: built.estimatedMinutes,
      warnings: built.warnings,
    };
  }
  if (turns.length === 0) return Response.json({ error: "turns o entityId requerido" }, { status: 400 });

  const host = body?.hostVoiceId ?? String((env as any).ELEVENLABS_VOICE_ID ?? "");
  const cohost = body?.cohostVoiceId ?? "";
  if (!host || !cohost) return Response.json({ error: "hostVoiceId and cohostVoiceId required" }, { status: 400 });

  try {
    const started = Date.now();
    const result = await synthesizeDialogue(
      turns,
      { host, cohost },
      body?.languageCode,
      typeof body?.stability === "number" ? { stability: body.stability } : {}
    );
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
      script: scriptMeta,
      elapsedMs: Date.now() - started,
    });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
};

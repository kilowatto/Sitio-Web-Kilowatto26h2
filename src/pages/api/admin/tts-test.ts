import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  synthesizeScript,
  concatChunksToR2,
  alignAudio,
  wordsToVtt,
  scriptHash,
  diagnoseCredentials,
} from "../../../lib/elevenlabs";

export const prerender = false;

// Credential diagnostics. Returns only metadata about the secrets (length, whitespace, whether
// the API accepts them) -- never the values.
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  return new Response(JSON.stringify(await diagnoseCredentials(), null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};

// Temporary: smoke-tests the real ElevenLabs chain on a SHORT snippet before spending money on
// a full article. Deliberately takes arbitrary text so the first paid call can be ~200
// characters (~$0.02) instead of a 27k-character investigación (~$2.73).
export const POST: APIRoute = async ({ url, request }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request
    .json<{ text?: string; align?: boolean; chain?: boolean; voiceSettings?: Record<string, number | boolean> }>()
    .catch(() => ({}) as any);
  const text =
    body?.text ??
    "Hola, soy Larry. Esta es una prueba de narración para kilowatto punto com. " +
      "Vamos a hablar de NVIDIA, OpenStack y PCIe para verificar la pronunciación técnica.";

  try {
    const started = Date.now();
    const result = await synthesizeScript(text, (body?.voiceSettings ?? {}) as any, body?.chain !== false);
    const hash = await scriptHash(text);
    // The settings must be part of the stitched key too, not just the per-chunk cache key --
    // otherwise two A/B variants of the same text write to the SAME object and the second
    // silently overwrites the first, making the comparison meaningless.
    const chainTag = body?.chain === false ? "nochain" : "chain";
    const settingsTag = Object.entries(body?.voiceSettings ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}${v}`)
      .join("-") || "default";
    const destKey = `media/audio/test/${hash.slice(0, 12)}-${settingsTag}-${chainTag}.mp3`;
    const bytes = await concatChunksToR2(result.chunks, destKey);

    let vttKey: string | null = null;
    let wordCount = 0;
    let lowConfidence = 0;
    if (body?.align) {
      const words = await alignAudio(destKey, text);
      if (words) {
        wordCount = words.length;
        lowConfidence = words.filter((w) => w.loss !== null && w.loss > 0.5).length;
        vttKey = `${destKey.replace(/\.mp3$/, "")}.vtt`;
        await env.MEDIA.put(vttKey, wordsToVtt(words), {
          httpMetadata: { contentType: "text/vtt; charset=utf-8" },
        });
      }
    }

    return new Response(
      JSON.stringify(
        {
          ok: true,
          elapsedMs: Date.now() - started,
          chunks: result.chunks.length,
          cachedChunks: result.cachedChunks,
          charactersBilled: result.charactersBilled,
          estimatedCostUsd: Number(((result.charactersBilled / 1000) * 0.1).toFixed(4)),
          audioKey: destKey,
          audioBytes: bytes,
          playUrl: `https://kilowatto.com/media/video/${destKey}`,
          settingsUsed: body?.voiceSettings ?? "default",
          vttKey,
          alignedWords: wordCount,
          lowConfidenceWords: lowConfidence,
        },
        null,
        2
      ),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

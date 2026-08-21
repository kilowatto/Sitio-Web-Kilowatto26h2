import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { buildAudioScript, findInventedNumbers, type EntityType } from "../../../lib/audio-script";
import { chunkScript } from "../../../lib/elevenlabs";

export const prerender = false;

// Temporary: exercises the script adaptation and chunking WITHOUT calling ElevenLabs, so the
// editorial half of the pipeline (chart figures rendered deterministically, the invented-number
// guard, chunk boundaries) can be verified before the TTS secret exists and before any
// characters get billed.
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const type = (url.searchParams.get("type") ?? "investigacion") as EntityType;
  const id = Number(url.searchParams.get("id") ?? "1");
  const locale = url.searchParams.get("locale") ?? "es-MX";
  const full = url.searchParams.get("full") === "1";

  try {
    const result = await buildAudioScript(type, id, locale);
    const chunks = chunkScript(result.script);

    return new Response(
      JSON.stringify(
        {
          sections: result.sections,
          warnings: result.warnings,
          totalCharacters: result.script.length,
          estimatedCostUsd: Number(((result.script.length / 1000) * 0.1).toFixed(3)),
          chunkCount: chunks.length,
          chunkSizes: chunks.map((c) => c.length),
          scriptPreview: full ? result.script : result.script.slice(0, 1500),
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

// Unit-check the number guard on demand -- it's the one piece of this whose failure mode is
// silent and editorially serious, so it's worth being able to prove it works in production.
export const POST: APIRoute = async ({ url, request }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json<{ source: string; adapted: string }>().catch(() => null);
  if (!body?.source || !body?.adapted) {
    return new Response(JSON.stringify({ error: "need {source, adapted}" }), { status: 400 });
  }
  return new Response(JSON.stringify({ invented: findInventedNumbers(body.source, body.adapted) }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};

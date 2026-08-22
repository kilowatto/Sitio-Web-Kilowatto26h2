import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Manages the ElevenLabs pronunciation dictionary that elevenlabs.ts attaches to every
// synthesis call. This is what makes "publicar automático" safe: a mispronounced brand or
// acronym would otherwise ship without anyone hearing it first.
//
// ALIAS rules, not <phoneme> tags: phoneme tags only work on eleven_flash_v2, and narration
// runs on eleven_multilingual_v2. An alias is a plain text substitution done before TTS, which
// works on every model.
//
// Rules are added only for terms VERIFIED to sound wrong. Speculative entries are a real risk:
// replacing a term the voice already handles correctly can easily make it worse.
const RULES: { string_to_replace: string; alias: string; why: string }[] = [
  {
    string_to_replace: "PCIe",
    alias: "PCI Express",
    // Confirmed by ear 2026-08-22: the only term of the three tested that came out wrong.
    // The voice handles NVIDIA and OpenStack correctly, so those are deliberately absent.
    why: "verificado a oído: sonaba mal; el resto del set de prueba sonó bien",
  },
  {
    string_to_replace: "NVMe",
    alias: "NVM Express",
    // Same failure shape as PCIe -- an initialism ending in a lowercase letter, which the
    // model reads as a word rather than spelling out. Included on that structural basis;
    // worth confirming by ear the first time it appears in a real article.
    why: "mismo patrón que PCIe (acrónimo + minúscula final), sin verificar aún",
  },
];

const KV_KEY = "elevenlabs_pronunciation_dictionaries";

function apiKey(): string {
  const k = String((env as any).ELEVENLABS_API_KEY ?? "").trim();
  if (!k) throw new Error("ELEVENLABS_API_KEY not set");
  return k;
}

// Creates a fresh dictionary version from RULES and stores its locator in KV, where
// elevenlabs.ts picks it up on the next call. Idempotent enough to re-run: ElevenLabs versions
// dictionaries, so a re-run just supersedes the previous locator.
export const POST: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/pronunciation-dictionaries/add-from-rules", {
      method: "POST",
      headers: { "xi-api-key": apiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "kilowatto-tecnicismos",
        description: "Términos técnicos que la voz Kilowatto pronuncia mal si se dejan crudos.",
        rules: RULES.map((r) => ({
          string_to_replace: r.string_to_replace,
          type: "alias",
          alias: r.alias,
        })),
      }),
    });

    const text = await res.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 500);
    }

    if (!res.ok) {
      return new Response(JSON.stringify({ status: res.status, body }, null, 2), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const locator = {
      pronunciation_dictionary_id: body?.id ?? body?.pronunciation_dictionary_id,
      version_id: body?.version_id,
    };
    if (!locator.pronunciation_dictionary_id || !locator.version_id) {
      return new Response(
        JSON.stringify({ error: "respuesta sin id/version_id", body }, null, 2),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    await env.KILOWATTO_KV.put(KV_KEY, JSON.stringify([locator]));

    return new Response(
      JSON.stringify({ ok: true, locator, rules: RULES, storedIn: KV_KEY }, null, 2),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// Shows what elevenlabs.ts will actually attach, so a wrong or stale locator is visible
// without reading code.
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const stored = await env.KILOWATTO_KV.get(KV_KEY);
  return new Response(JSON.stringify({ stored: stored ? JSON.parse(stored) : null, rules: RULES }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};

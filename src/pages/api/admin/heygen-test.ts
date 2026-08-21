import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Temporary: empirically settles whether HeyGen can lip-sync Larry, who is exactly the case
// HeyGen's own help center flags as risky ("beaks / snouts / heavy masks that hide the mouth
// area" under "usually doesn't work well"). The plan gates the whole videocolumna phase on
// this answer, so it gets tested with a few cents of real render before anything is built.
//
// Uses the v3 API: v1/v2 retire 2026-11-01. For type:"image" the Avatar IV engine is implicit
// and the `engine` field must be OMITTED -- the schema is additionalProperties:false and has
// no `engine` property, so sending it is a 400. Avatar IV is the only engine accepting an
// arbitrary image, which is precisely what we need.
const BASE = "https://api.heygen.com";

function key(): string {
  const k = String((env as any).HEYGEN_API_KEY ?? "").trim();
  if (!k) throw new Error("HEYGEN_API_KEY not set");
  return k;
}

async function hg(path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "X-Api-Key": key(), ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 500);
  }
  return { status: res.status, body };
}

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const action = url.searchParams.get("action") ?? "whoami";
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json" } });

  try {
    if (action === "whoami") {
      // Cheapest authenticated call: validates the key and reports the prepaid wallet, since
      // API usage bills against a wallet separate from any web subscription.
      const raw = String((env as any).HEYGEN_API_KEY ?? "");
      const me = await hg("/v3/users/me");
      return json({
        keyLength: raw.length,
        keyHadWhitespace: raw !== raw.trim(),
        status: me.status,
        body: me.body,
      });
    }

    if (action === "voices") {
      // Need a Spanish voice id for the smoke test. Deliberately using HeyGen's own TTS here
      // rather than ElevenLabs, so a failure is unambiguously about the FACE and not about
      // the (currently broken) ElevenLabs credential.
      const res = await hg("/v3/voices?limit=100");
      const list = res.body?.data?.voices ?? res.body?.data?.list ?? res.body?.data ?? [];
      const spanish = (Array.isArray(list) ? list : [])
        .filter((v: any) => String(v.language ?? v.locale ?? "").toLowerCase().includes("spanish") ||
                            String(v.locale ?? "").toLowerCase().startsWith("es"))
        .slice(0, 12)
        .map((v: any) => ({ voice_id: v.voice_id ?? v.id, name: v.name, language: v.language ?? v.locale, gender: v.gender }));
      return json({ status: res.status, totalReturned: Array.isArray(list) ? list.length : 0, spanishSample: spanish });
    }

    if (action === "status") {
      const videoId = url.searchParams.get("video_id");
      if (!videoId) return json({ error: "falta video_id" }, 400);
      const res = await hg(`/v3/videos/${videoId}`);
      return json({ status: res.status, body: res.body });
    }

    return json({ error: `acción desconocida: ${action}` }, 400);
  } catch (err: any) {
    return json({ error: String(err?.message ?? err) }, 500);
  }
};

// Creates the test render. Kept POST so it can't be triggered by an accidental GET -- every
// call costs real money (~$0.05/second of output).
export const POST: APIRoute = async ({ url, request }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json<{ imageUrl?: string; script?: string; voiceId?: string; audioUrl?: string }>().catch(
    () => ({}) as any
  );

  const imageUrl = body?.imageUrl ?? "https://kilowatto.com/larry/larry-avatar-share.jpg";
  // Short on purpose: long enough to judge lip-sync, short enough to cost cents.
  const script = body?.script ?? "Hola, soy Larry. Vamos a ver si mi hocico puede hablar.";

  const payload: Record<string, unknown> = {
    type: "image",
    image: { type: "url", url: imageUrl },
    resolution: "1080p", // Avatar IV does not do 4K, whatever the help center says
    aspect_ratio: "auto",
    fit: "contain",
    title: "Larry lip-sync feasibility test",
  };

  // Either uploaded audio (the real pipeline shape) or HeyGen TTS (the isolation-friendly
  // test shape). These are mutually exclusive in the API.
  if (body?.audioUrl) {
    payload.audio_url = body.audioUrl;
  } else {
    payload.script = script;
    if (!body?.voiceId) {
      return new Response(JSON.stringify({ error: "falta voiceId (o manda audioUrl)" }, null, 2), { status: 400 });
    }
    payload.voice_id = body.voiceId;
  }

  try {
    const res = await hg("/v3/videos", {
      method: "POST",
      body: JSON.stringify(payload),
      // Workers retry on their own; an idempotency key stops a retry from double-billing.
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    return new Response(JSON.stringify({ status: res.status, sent: payload, body: res.body }, null, 2), {
      status: res.status < 400 ? 200 : res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }, null, 2), { status: 500 });
  }
};

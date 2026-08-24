import { env } from "cloudflare:workers";

// Video generation through ElevenCreative Flows.
//
// Found on 2026-08-23 after Esteban refused to accept that ElevenLabs had no video API. The
// Avatars capability page does say "API access: Not available at launch" -- and that is true of
// Avatars specifically. The video API lives under Flows, under the same key we already use for
// every narration.
//
// `creatify-aurora` is the one that matters for Larry: it takes an audio track and an image of
// "the character to animate" -- character, not person -- and drives the lip movement from the
// audio. There is no human face detection to fight, which is exactly the wall HeyGen put up,
// where the threshold turned out to be muzzle geometry and no camera angle was programmable.
//
// Failed generations are not charged, so iterating on the character is free the same way
// HeyGen's face detection was.

const API_BASE = "https://api.elevenlabs.io";

function apiKey(): string {
  const k = String((env as any).ELEVENLABS_API_KEY ?? "").trim();
  if (!k) throw new Error("ELEVENLABS_API_KEY no está configurado");
  return k;
}

export interface UploadedAsset {
  asset_id: string;
  mime_type: string;
}

export async function uploadAsset(bytes: Uint8Array, name: string, mimeType: string): Promise<UploadedAsset> {
  const form = new FormData();
  form.append("asset", new Blob([bytes], { type: mimeType }), name);
  form.append("name", name);
  const res = await fetch(`${API_BASE}/v1/assets`, {
    method: "POST",
    headers: { "xi-api-key": apiKey() },
    body: form,
  });
  if (!res.ok) throw new Error(`assets upload falló (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json<UploadedAsset>();
}

export async function uploadFromR2(key: string, name: string, mimeType: string): Promise<UploadedAsset> {
  const obj = await env.MEDIA.get(key);
  if (!obj) throw new Error(`no existe en R2: ${key}`);
  return uploadAsset(new Uint8Array(await obj.arrayBuffer()), name, mimeType);
}

// Inline base64 instead of an uploaded asset.
//
// POST /v1/assets answers 402 "This endpoint requires a Pro plan or above" and Esteban is on
// Creator. The video endpoint takes the bytes inline as an alternative -- up to 25 MB decoded --
// which sidesteps the assets API entirely. A podcast cover is 367 KB and ten seconds of speech
// is about 240 KB, so the ceiling is nowhere near.
//
// btoa() takes a binary string, and String.fromCharCode.apply blows the stack past ~100k
// arguments, so this walks the array in chunks.
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function inlineFromR2(
  key: string,
  mimeType: string
): Promise<{ type: "inline_base64"; content_base64: string; mime_type: string }> {
  const obj = await env.MEDIA.get(key);
  if (!obj) throw new Error(`no existe en R2: ${key}`);
  const bytes = new Uint8Array(await obj.arrayBuffer());
  if (bytes.length > 24_000_000) throw new Error(`${key} pesa ${Math.round(bytes.length / 1e6)} MB, el tope inline es 25 MB`);
  return { type: "inline_base64", content_base64: toBase64(bytes), mime_type: mimeType };
}

export interface VideoRequest {
  model_id: string;
  [key: string]: unknown;
}

export async function createVideo(body: VideoRequest): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API_BASE}/v1/flows/video`, {
    method: "POST",
    headers: { "xi-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`flows/video falló (${res.status}): ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

export interface VideoStatus {
  status: string;
  content_url?: string;
  content_mime_type?: string;
  error_message?: string;
  failure_reason?: string;
}

export async function getVideo(generationId: string): Promise<VideoStatus> {
  const res = await fetch(`${API_BASE}/v1/flows/video/${generationId}`, {
    headers: { "xi-api-key": apiKey() },
  });
  if (!res.ok) throw new Error(`flows/video get falló (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// Copies a finished generation into R2. The signed content_url expires in about an hour, which
// is the same trap the plan already recorded for ElevenLabs flow outputs: fetch the bytes now,
// not later.
export async function storeVideo(contentUrl: string, key: string): Promise<number> {
  const res = await fetch(contentUrl);
  if (!res.ok) throw new Error(`descarga del video falló (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "video/mp4" } });
  return bytes.length;
}

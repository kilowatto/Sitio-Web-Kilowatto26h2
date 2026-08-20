import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { captionAndFlag, cleanCityName } from "../../../lib/photo-caption";
import { hashBytes, registerForDedup } from "../../../lib/photo-dedup";

export const prerender = false;

// One-off: re-runs the new landmark/orange-aware caption pipeline over every already-
// approved photo (Esteban's explicit call — consistency across the whole public gallery
// from day one, not just new uploads). Batched with a cursor like recheck-flags.ts to stay
// under Cloudflare's per-request resource limits. Never touches minor_flag/approval_status
// (already-reviewed photos stay reviewed) — only ai_caption, taken_city, wearing_orange,
// file_hash, and registers each into the dedup index for the first time.
// One photo per request — confirmed live 2026-07-20 that even 4 photos/request with fully
// sequential vision calls still hit "Worker exceeded memory limit" on real ~2.5MB photos.
// Whatever the exact cause (GC not reclaiming between loop iterations within one isolate
// invocation, the AI binding's internal copy of the image array, or both), the only
// combination that reliably worked was bounding each request to a single photo.
const BATCH_SIZE = 1;

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const afterId = Number(url.searchParams.get("afterId") ?? 0);
  // Filters out already-touched photos (file_hash set) regardless of afterId — a client
  // retry after a dropped connection just re-requests from afterId=0 and this makes that
  // safe/cheap instead of silently redoing finished work with more AI calls.
  const { results: approved } = await env.DB.prepare(
    "SELECT id, r2_key, taken_city FROM photos WHERE approval_status = 'approved' AND id > ? AND (file_hash IS NULL OR file_hash = '') ORDER BY id LIMIT ?"
  )
    .bind(afterId, BATCH_SIZE)
    .all<any>();

  const updates: any[] = [];

  for (const p of approved ?? []) {
    const object = await env.MEDIA.get(p.r2_key);
    if (!object) continue;
    const bytes = new Uint8Array(await object.arrayBuffer());

    const cleanedCity = p.taken_city ? await cleanCityName(p.taken_city) : p.taken_city;
    const { caption, wearingOrange, sceneDescription } = await captionAndFlag(bytes, cleanedCity);
    const fileHash = await hashBytes(bytes);

    await env.DB.prepare(
      "UPDATE photos SET ai_caption = ?, taken_city = ?, wearing_orange = ?, file_hash = ? WHERE id = ?"
    )
      .bind(caption, cleanedCity, wearingOrange ? 1 : 0, fileHash, p.id)
      .run();

    const row = await env.DB.prepare("SELECT album, taken_date FROM photos WHERE id = ?").bind(p.id).first<any>();
    await registerForDedup(p.id, row?.album ?? "", row?.taken_date ?? null, sceneDescription);

    updates.push({ id: p.id, caption, city: cleanedCity, wearingOrange });
  }

  const lastId = updates.length ? updates[updates.length - 1].id : afterId;
  const done = (approved?.length ?? 0) < BATCH_SIZE;
  return new Response(JSON.stringify({ ok: true, total: updates.length, done, lastId, updates }), {
    headers: { "content-type": "application/json" },
  });
};

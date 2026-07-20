import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { captionAndFlag } from "../../../lib/photo-caption";

export const prerender = false;

// One-off backfill: classifies solo_subject for photos from before this column existed.
// Covers pending too (not just approved) — harmless metadata either way, since the hero
// query only ever pulls approved+solo rows, but it means the moment Esteban approves a
// pending photo that's already classified solo, it's immediately eligible for rotation
// instead of waiting on a separate backfill pass. Batched (same pattern as
// recheck-flags.ts) to stay under Cloudflare's per-request resource limit.
const BATCH_SIZE = 8;

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const afterId = Number(url.searchParams.get("afterId") ?? 0);
  const { results: rows } = await env.DB.prepare(
    `SELECT id, r2_key, approval_status FROM photos WHERE approval_status IN ('approved', 'pending') AND id > ? ORDER BY id LIMIT ?`
  )
    .bind(afterId, BATCH_SIZE)
    .all<any>();

  const updates: any[] = [];
  for (const p of rows ?? []) {
    const object = await env.MEDIA.get(p.r2_key);
    if (!object) continue;
    const bytes = new Uint8Array(await object.arrayBuffer());
    const { soloSubject } = await captionAndFlag(bytes);
    await env.DB.prepare("UPDATE photos SET solo_subject = ? WHERE id = ?").bind(soloSubject ? 1 : 0, p.id).run();
    updates.push({ id: p.id, soloSubject, approvalStatus: p.approval_status });
  }

  const lastId = updates.length ? updates[updates.length - 1].id : afterId;
  const done = (rows?.length ?? 0) < BATCH_SIZE;
  return new Response(JSON.stringify({ ok: true, total: updates.length, done, lastId, updates }), {
    headers: { "content-type": "application/json" },
  });
};

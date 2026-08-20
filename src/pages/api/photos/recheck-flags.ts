import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { captionAndFlag } from "../../../lib/photo-caption";

export const prerender = false;

// One-off: re-runs captionAndFlag on every pending photo after the MINOR_KEYWORDS
// false-positive fix (it was matching the model's own "MINOR:" field label, forcing
// every photo to flagged regardless of content). Only touches pending photos — never
// auto-changes anything already approved/rejected by Esteban.
const BATCH_SIZE = 8; // keeps each invocation well under Cloudflare's per-request resource limits

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const afterId = Number(url.searchParams.get("afterId") ?? 0);
  const { results: pending } = await env.DB.prepare(
    "SELECT id, r2_key, taken_city FROM photos WHERE approval_status = 'pending' AND id > ? ORDER BY id LIMIT ?"
  )
    .bind(afterId, BATCH_SIZE)
    .all<any>();

  const updates: any[] = [];

  for (const p of pending ?? []) {
    const object = await env.MEDIA.get(p.r2_key);
    if (!object) continue;
    const bytes = new Uint8Array(await object.arrayBuffer());
    const { caption, minorFlag } = await captionAndFlag(bytes, p.taken_city);
    await env.DB.prepare("UPDATE photos SET ai_caption = ?, minor_flag = ? WHERE id = ?")
      .bind(caption, minorFlag, p.id)
      .run();
    updates.push({ id: p.id, minorFlag });
  }

  const stillFlagged = updates.filter((u) => u.minorFlag === "flagged").length;
  const lastId = updates.length ? updates[updates.length - 1].id : afterId;
  const done = (pending?.length ?? 0) < BATCH_SIZE;
  return new Response(JSON.stringify({ ok: true, total: updates.length, stillFlagged, done, lastId, updates }), {
    headers: { "content-type": "application/json" },
  });
};

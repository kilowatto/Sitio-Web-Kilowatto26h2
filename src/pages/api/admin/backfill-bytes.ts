import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Fills media_assets.bytes from R2. Idempotent: only touches rows where it's still null.
// Uses head() so no audio is ever transferred.
export const POST: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
  const rows = await env.DB.prepare(
    `SELECT id, r2_key FROM media_assets WHERE r2_key IS NOT NULL AND bytes IS NULL`
  ).all<{ id: number; r2_key: string }>();

  let updated = 0;
  const missing: string[] = [];
  for (const row of rows.results ?? []) {
    const head = await env.MEDIA.head(row.r2_key);
    if (!head) { missing.push(row.r2_key); continue; }
    await env.DB.prepare(`UPDATE media_assets SET bytes = ? WHERE id = ?`).bind(head.size, row.id).run();
    updated++;
  }
  return new Response(JSON.stringify({ updated, missing }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};

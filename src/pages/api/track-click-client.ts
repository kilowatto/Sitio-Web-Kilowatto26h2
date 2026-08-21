import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 100000 ? n : null;
}

// Public beacon fired by the /r/[slug] interstitial to enrich its own link_clicks row with
// screen/viewport data that only exists client-side. No admin token -- this is analytics
// enrichment, not a sensitive write; worst case a bad actor pollutes a click's screen fields.
export const POST: APIRoute = async ({ request }) => {
  const body = await request
    .json<{ id?: number; screenWidth?: number; screenHeight?: number; viewportWidth?: number; viewportHeight?: number; devicePixelRatio?: number }>()
    .catch(() => ({}) as any);

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return new Response(null, { status: 204 });

  await env.DB.prepare(
    `UPDATE link_clicks SET screen_width = ?, screen_height = ?, viewport_width = ?, viewport_height = ?, device_pixel_ratio = ? WHERE id = ?`
  )
    .bind(num(body.screenWidth), num(body.screenHeight), num(body.viewportWidth), num(body.viewportHeight), body.devicePixelRatio ?? null, id)
    .run()
    .catch((err) => console.error("track-click-client update failed:", err));

  return new Response(null, { status: 204 });
};

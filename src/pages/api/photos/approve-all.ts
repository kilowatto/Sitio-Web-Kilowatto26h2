import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  // Same rule as the single-photo endpoint: only the phrase below (typed by a human in the
  // confirm dialog, not just clicked) unlocks flagged photos in bulk.
  const confirmPhrase = url.searchParams.get("confirmPhrase");
  const REQUIRED_PHRASE = "APRUEBO TODAS";

  const { results: pending } = await env.DB
    .prepare("SELECT id, minor_flag FROM photos WHERE approval_status = 'pending'")
    .all<any>();

  const flaggedCount = (pending ?? []).filter((p: any) => p.minor_flag === "flagged").length;

  if (flaggedCount > 0 && confirmPhrase !== REQUIRED_PHRASE) {
    return new Response(
      JSON.stringify({
        error: `Hay ${flaggedCount} fotos marcadas como posible menor. Se requiere confirmPhrase="${REQUIRED_PHRASE}" para aprobarlas en bloque.`,
        flaggedCount,
      }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
  }

  await env.DB
    .prepare("UPDATE photos SET approval_status = 'approved', approved_at = datetime('now') WHERE approval_status = 'pending'")
    .run();

  return new Response(JSON.stringify({ ok: true, approved: (pending ?? []).length }), {
    headers: { "content-type": "application/json" },
  });
};

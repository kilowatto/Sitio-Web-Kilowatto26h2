import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Receives listening telemetry from the audio player. Public and unauthenticated by design --
// it's the same trust model as the page-view logging in middleware.ts, and it carries no
// personal data: an entity id, an event name, and a position in seconds.
//
// Called via navigator.sendBeacon, which fires reliably during page unload where a normal
// fetch() would be cancelled. sendBeacon always sends a POST with no custom headers, so this
// route must not require any.
//
// Schema for kilowatto_audio_events (Analytics Engine is append-only and schemaless, so the
// column meanings live here and must not be reordered -- existing rows would be reinterpreted):
//   blob1 entityType   blob2 entityId   blob3 locale   blob4 event   blob5 country
//   blob6 device       blob7 pathname
//   double1 positionSeconds   double2 durationSeconds   double3 percentOfDuration
//   index1 "{entityType}:{entityId}"
const VALID_EVENTS = new Set(["play", "pause", "seek", "progress", "ended", "ratechange"]);

function deviceOf(ua: string): string {
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

export const POST: APIRoute = async ({ request }) => {
  // Always 204, even on bad input: this is fire-and-forget telemetry and a failing beacon must
  // never surface as a console error on an article page.
  const ok = () => new Response(null, { status: 204 });

  try {
    const body = await request.json<{
      entityType?: string;
      entityId?: number;
      locale?: string;
      event?: string;
      position?: number;
      duration?: number;
      pathname?: string;
    }>();

    const entityType = String(body?.entityType ?? "");
    const entityId = Number(body?.entityId);
    const event = String(body?.event ?? "");

    if (!["columna", "investigacion"].includes(entityType)) return ok();
    if (!Number.isFinite(entityId) || entityId <= 0) return ok();
    if (!VALID_EVENTS.has(event)) return ok();

    const position = Number.isFinite(Number(body?.position)) ? Number(body!.position) : 0;
    const duration = Number.isFinite(Number(body?.duration)) ? Number(body!.duration) : 0;
    const percent = duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;

    const cf = (request as any).cf ?? {};
    env.AUDIO_ANALYTICS?.writeDataPoint({
      blobs: [
        entityType,
        String(entityId),
        String(body?.locale ?? "es-MX"),
        event,
        String(cf.country ?? ""),
        deviceOf(request.headers.get("user-agent") ?? ""),
        String(body?.pathname ?? "").slice(0, 200),
      ],
      doubles: [position, duration, percent],
      indexes: [`${entityType}:${entityId}`],
    });
  } catch {
    // swallow -- see above
  }

  return ok();
};

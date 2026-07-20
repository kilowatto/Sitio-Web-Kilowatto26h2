import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { unzipSync } from "fflate";
import * as exifr from "exifr";
import { stripJpegMetadata, stripPngMetadata } from "../../../lib/strip-metadata";
import { reverseGeocode } from "../../../lib/geocode";
import { captionAndFlag } from "../../../lib/photo-caption";

export const prerender = false;

const SUPPORTED = new Set(["jpg", "jpeg", "png"]);
// HEIC/video need macOS `sips` (native, not available in a Worker) — those still go through
// the local script. This endpoint handles the common case (JPG/PNG straight from a phone
// export, WhatsApp, downloads, etc.) so most zips don't need any local processing at all.

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const album = url.searchParams.get("album") ?? "familia";
  const formData = await request.formData();
  const file = formData.get("zip");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "missing zip file field" }), { status: 400 });
  }

  const zipBytes = new Uint8Array(await file.arrayBuffer());
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "invalid zip: " + String(err?.message ?? err) }), { status: 400 });
  }

  const processed: string[] = [];
  const skipped: string[] = [];

  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith("/") || name.startsWith("__MACOSX")) continue; // directory entries / macOS zip junk
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (!SUPPORTED.has(ext)) {
      skipped.push(name);
      continue;
    }

    try {
      let takenDate: string | null = null;
      let takenCity: string | null = null;
      let orientation: number | undefined;
      const meta = await exifr.parse(data, { gps: true, exif: true, tiff: true, translateValues: false }).catch(() => null);
      if (meta) {
        const d = meta.DateTimeOriginal || meta.CreateDate || meta.ModifyDate;
        if (d instanceof Date) takenDate = d.toISOString().slice(0, 10);
        if (meta.latitude && meta.longitude) {
          takenCity = await reverseGeocode(meta.latitude, meta.longitude);
          await new Promise((r) => setTimeout(r, 1100)); // respect Nominatim's 1req/sec policy
        }
        if (typeof meta.Orientation === "number") orientation = meta.Orientation;
      }

      const cleaned = ext === "png" ? stripPngMetadata(data) : stripJpegMetadata(data, orientation);
      const key = `photos/${album}/${crypto.randomUUID()}.${ext === "png" ? "png" : "jpg"}`;
      await env.MEDIA.put(key, cleaned, {
        httpMetadata: { contentType: ext === "png" ? "image/png" : "image/jpeg" },
      });

      const { caption, minorFlag } = await captionAndFlag(cleaned);

      await env.DB.prepare(
        `INSERT INTO photos (r2_key, ai_caption, album, taken_date, taken_city, minor_flag, approval_status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`
      )
        .bind(key, caption, album, takenDate, takenCity, minorFlag)
        .run();

      processed.push(name);
    } catch (err: any) {
      console.error(`Failed processing ${name}:`, err);
      skipped.push(`${name} (error: ${String(err?.message ?? err)})`);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: processed.length,
      skipped: skipped.length,
      skippedFiles: skipped,
    }),
    { headers: { "content-type": "application/json" } }
  );
};

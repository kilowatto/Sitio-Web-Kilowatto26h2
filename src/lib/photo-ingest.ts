import { env } from "cloudflare:workers";
import * as exifr from "exifr";
import { stripJpegMetadata, stripPngMetadata } from "./strip-metadata";
import { reverseGeocode } from "./geocode";
import { captionAndFlag, cleanCityName } from "./photo-caption";
import { hashBytes, findDuplicate, registerForDedup } from "./photo-dedup";

export const SUPPORTED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

export interface IngestResult {
  ok: boolean;
  name: string;
  reason?: string;
  duplicate?: boolean;
}

// Shared by both upload paths (zip and direct multi-file) — one file in, one D1 row out.
// HEIC/video still need macOS `sips` (native, not available in a Worker), so this only
// ever handles JPG/PNG; callers report anything else as skipped rather than failing.
export async function ingestImageFile(name: string, data: Uint8Array, album: string): Promise<IngestResult> {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
    return { ok: false, name, reason: "unsupported format (HEIC/video need the local script)" };
  }

  try {
    // Exact-duplicate check happens first, before spending anything on vision AI — cheapest
    // possible reject for the common case of re-uploading the same file twice.
    const fileHash = await hashBytes(data);
    const exactMatch = await env.DB.prepare("SELECT id FROM photos WHERE file_hash = ?").bind(fileHash).first<any>();
    if (exactMatch) {
      return { ok: false, name, reason: `duplicado exacto de la foto #${exactMatch.id}`, duplicate: true };
    }

    let takenDate: string | null = null;
    let takenCity: string | null = null;
    let orientation: number | undefined;
    const meta = await exifr.parse(data, { gps: true, exif: true, tiff: true, translateValues: false }).catch(() => null);
    if (meta) {
      const d = meta.DateTimeOriginal || meta.CreateDate || meta.ModifyDate;
      if (d instanceof Date) takenDate = d.toISOString().slice(0, 10);
      if (meta.latitude && meta.longitude) {
        const rawCity = await reverseGeocode(meta.latitude, meta.longitude);
        takenCity = rawCity ? await cleanCityName(rawCity) : null;
        await new Promise((r) => setTimeout(r, 1100)); // respect Nominatim's 1req/sec policy
      }
      if (typeof meta.Orientation === "number") orientation = meta.Orientation;
    }

    const cleaned = ext === "png" ? stripPngMetadata(data) : stripJpegMetadata(data, orientation);

    const { caption, minorFlag, soloSubject, wearingOrange, sceneDescription } = await captionAndFlag(cleaned, takenCity);

    const nearDuplicate = await findDuplicate(data, album, takenDate, sceneDescription);
    if (nearDuplicate) {
      return { ok: false, name, reason: `muy similar a la foto #${nearDuplicate.duplicateOf}`, duplicate: true };
    }

    const key = `photos/${album}/${crypto.randomUUID()}.${ext === "png" ? "png" : "jpg"}`;
    await env.MEDIA.put(key, cleaned, {
      httpMetadata: { contentType: ext === "png" ? "image/png" : "image/jpeg" },
    });

    const res = await env.DB.prepare(
      `INSERT INTO photos (r2_key, ai_caption, album, taken_date, taken_city, minor_flag, solo_subject, wearing_orange, file_hash, approval_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    )
      .bind(key, caption, album, takenDate, takenCity, minorFlag, soloSubject ? 1 : 0, wearingOrange ? 1 : 0, fileHash)
      .run();

    await registerForDedup(res.meta.last_row_id as number, album, takenDate, sceneDescription);

    return { ok: true, name };
  } catch (err: any) {
    console.error(`Failed processing ${name}:`, err);
    return { ok: false, name, reason: String(err?.message ?? err) };
  }
}

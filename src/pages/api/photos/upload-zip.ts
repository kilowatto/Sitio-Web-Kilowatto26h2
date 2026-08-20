import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { unzipSync } from "fflate";
import { ingestImageFile } from "../../../lib/photo-ingest";

export const prerender = false;

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
  let duplicates = 0;

  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith("/") || name.startsWith("__MACOSX")) continue; // directory entries / macOS zip junk
    const result = await ingestImageFile(name, data, album);
    if (result.ok) processed.push(name);
    else {
      if (result.duplicate) duplicates++;
      skipped.push(`${name}${result.reason ? ` (${result.reason})` : ""}`);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: processed.length,
      skipped: skipped.length,
      duplicates,
      skippedFiles: skipped,
    }),
    { headers: { "content-type": "application/json" } }
  );
};

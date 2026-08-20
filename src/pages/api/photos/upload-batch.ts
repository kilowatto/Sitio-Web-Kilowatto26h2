import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { ingestImageFile } from "../../../lib/photo-ingest";

export const prerender = false;

// Direct multi-file upload — no zip step. Lets a drag-and-drop of 1-150 photos, or an
// iPhone's native multi-select from Photos, go straight to D1/R2. The client chunks large
// batches into several requests (a few files each) rather than one giant one, so this
// endpoint just processes whatever "files" entries land in a single call.
export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN && token !== env.SCRATCH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const album = url.searchParams.get("album") ?? "familia";
  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return new Response(JSON.stringify({ error: "no files provided" }), { status: 400 });
  }

  const processed: string[] = [];
  const skipped: string[] = [];
  let duplicates = 0;

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await ingestImageFile(file.name, bytes, album);
    if (result.ok) processed.push(result.name);
    else {
      if (result.duplicate) duplicates++;
      skipped.push(`${result.name}${result.reason ? ` (${result.reason})` : ""}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: processed.length, skipped: skipped.length, duplicates, skippedFiles: skipped }),
    { headers: { "content-type": "application/json" } }
  );
};

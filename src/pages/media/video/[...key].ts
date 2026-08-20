import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Range-aware R2 proxy — plain /media/[...key] always returns the full object with no
// Accept-Ranges, which breaks native <video> seeking: browsers report `seekable = [0,0]` for a
// resource that never answers a Range request with 206, even once it's fully buffered. This
// route slices the object per the incoming Range header so <video currentTime> scrubbing works
// the way it does for any normal streamed video, without needing a client-side Blob workaround.
export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key;
  if (!key) return new Response("not found", { status: 404 });

  const object = await env.MEDIA.get(key);
  if (!object) return new Response("not found", { status: 404 });

  const contentType = object.httpMetadata?.contentType ?? "application/octet-stream";
  const buffer = await object.arrayBuffer();
  const size = buffer.byteLength;

  const baseHeaders = {
    "content-type": contentType,
    "accept-ranges": "bytes",
    // "private" (not "public") on purpose: confirmed live that once Cloudflare's edge cached a
    // "public" response for this URL, a follow-up Range request against that cached entry came
    // back 404 instead of a proper 206 slice — the platform's automatic range-from-cache handling
    // doesn't play well with this route. "private" keeps the long-lived immutable cache at the
    // browser (still fast on repeat visits) while every request hits this Worker fresh, where our
    // own range logic below always runs correctly.
    "cache-control": "private, max-age=31536000, immutable",
  };

  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) {
    return new Response(buffer, { headers: { ...baseHeaders, "content-length": String(size) } });
  }

  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match || (!match[1] && !match[2])) {
    return new Response(buffer, { headers: { ...baseHeaders, "content-length": String(size) } });
  }

  let start = match[1] ? parseInt(match[1], 10) : size - parseInt(match[2], 10);
  let end = match[1] && match[2] ? parseInt(match[2], 10) : size - 1;
  if (Number.isNaN(start) || start < 0) start = 0;
  if (Number.isNaN(end) || end >= size) end = size - 1;

  if (start > end || start >= size) {
    return new Response(null, { status: 416, headers: { ...baseHeaders, "content-range": `bytes */${size}` } });
  }

  const slice = buffer.slice(start, end + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      ...baseHeaders,
      "content-length": String(slice.byteLength),
      "content-range": `bytes ${start}-${end}/${size}`,
    },
  });
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// Range-aware R2 proxy — plain /media/[...key] always returns the full object with no
// Accept-Ranges, which breaks native <video> seeking: browsers report `seekable = [0,0]` for a
// resource that never answers a Range request with 206, even once it's fully buffered. This
// route slices the object per the incoming Range header so <video currentTime> scrubbing works
// the way it does for any normal streamed video, without needing a client-side Blob workaround.
//
// Serves audio too (narrated articles), which is what forced the rewrite below: this used to
// do `await object.arrayBuffer()` and slice in memory. A 30-minute narration at 192 kbps is
// ~43 MB, and a Worker isolate has 128 MB shared across concurrent requests — a handful of
// simultaneous listeners would OOM it. Now the byte range is pushed down into R2 and the body
// is streamed straight through, so peak memory is a buffer's worth regardless of file size.
export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key;
  if (!key) return new Response("not found", { status: 404 });

  // HEAD first: we need the total size to validate the range and build Content-Range, and
  // head() fetches metadata without transferring the body.
  const meta = await env.MEDIA.head(key);
  if (!meta) return new Response("not found", { status: 404 });

  const size = meta.size;
  const baseHeaders = {
    "content-type": meta.httpMetadata?.contentType ?? "application/octet-stream",
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

  const whole = async () => {
    const object = await env.MEDIA.get(key);
    if (!object) return new Response("not found", { status: 404 });
    return new Response(object.body, {
      headers: { ...baseHeaders, "content-length": String(size) },
    });
  };

  if (!rangeHeader) return whole();

  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match || (!match[1] && !match[2])) return whole();

  // Two forms: "bytes=START-[END]" and the suffix form "bytes=-N" (last N bytes).
  let start: number;
  let end: number;
  if (match[1]) {
    start = parseInt(match[1], 10);
    end = match[2] ? parseInt(match[2], 10) : size - 1;
  } else {
    const suffixLength = parseInt(match[2], 10);
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  }

  if (Number.isNaN(start) || start < 0) start = 0;
  if (Number.isNaN(end) || end >= size) end = size - 1;

  if (start > end || start >= size) {
    return new Response(null, {
      status: 416,
      headers: { ...baseHeaders, "content-range": `bytes */${size}` },
    });
  }

  const length = end - start + 1;
  const object = await env.MEDIA.get(key, { range: { offset: start, length } });
  if (!object) return new Response("not found", { status: 404 });

  return new Response(object.body, {
    status: 206,
    headers: {
      ...baseHeaders,
      "content-length": String(length),
      "content-range": `bytes ${start}-${end}/${size}`,
    },
  });
};

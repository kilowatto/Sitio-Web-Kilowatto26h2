import { buildOAuth1Header } from "./oauth1";

// Attaching media to a post.
//
// Until now nothing did. brand_posts has carried image_r2_key since the beginning and
// publishPost() only ever sent `text` -- so every generated image for every post since July was
// stored, shown in /admin, and then dropped on the floor at publish time. The clip work made that
// impossible to leave alone: a video post with no video is not a post.
//
// Both platforms want the same three steps for video (declare the size, push the bytes, close the
// upload) and both express them differently enough that there is no shared abstraction worth
// building. What IS shared is the failure policy, and it is deliberate: a media upload that fails
// returns null and the caller posts the text anyway. Silence beats a queue that stalls because a
// third party's upload endpoint had a bad afternoon.

// The isolate has 128 MB across all concurrent requests and the whole file is held in memory
// twice at worst (R2 read, then the chunk slices). Clips run 3-8 MB; anything approaching this
// cap is a bug upstream, not a legitimate post.
const MAX_MEDIA_BYTES = 64 * 1024 * 1024;

// X takes up to 5 MB per APPEND; LinkedIn's own instructions come back in 4 MiB ranges. One
// number for both keeps the two paths comparable when reading logs.
const CHUNK_BYTES = 4 * 1024 * 1024;

export interface MediaRef {
  /** Opaque to the caller: a numeric media_id on X, a urn:li:video/image on LinkedIn. */
  id: string;
}

interface OAuth1Credentials {
  apiKey: string;
  apiKeySecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export async function readMedia(env: any, key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const obj = await env.MEDIA.get(key);
  if (!obj) {
    console.error(`media ${key} no está en R2`);
    return null;
  }
  if (obj.size > MAX_MEDIA_BYTES) {
    console.error(`media ${key} pesa ${obj.size} bytes, por encima del tope de ${MAX_MEDIA_BYTES}`);
    return null;
  }
  const bytes = new Uint8Array(await obj.arrayBuffer());
  const contentType =
    obj.httpMetadata?.contentType ?? (key.endsWith(".mp4") ? "video/mp4" : "image/png");
  return { bytes, contentType };
}

// ---------------------------------------------------------------------------------------------
// X
// ---------------------------------------------------------------------------------------------

const X_UPLOAD_URL = "https://api.x.com/2/media/upload";

// OAuth 1.0a signs the query string but NOT a multipart body -- so every command below travels in
// the body and the signature covers the bare URL. Putting the same parameters in the query
// instead would need them folded into the signature base string, which is exactly the class of
// mismatch that produces an opaque 401 with no indication of which parameter was wrong.
async function xUploadFetch(creds: OAuth1Credentials, form: FormData): Promise<any> {
  const authorization = await buildOAuth1Header("POST", X_UPLOAD_URL, creds);
  const res = await fetch(X_UPLOAD_URL, { method: "POST", headers: { authorization }, body: form });
  if (!res.ok) throw new Error(`X media ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function xUploadStatus(creds: OAuth1Credentials, mediaId: string): Promise<any> {
  const url = `${X_UPLOAD_URL}?command=STATUS&media_id=${encodeURIComponent(mediaId)}`;
  const authorization = await buildOAuth1Header("GET", url, creds);
  const res = await fetch(url, { headers: { authorization } });
  if (!res.ok) throw new Error(`X media STATUS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export async function uploadMediaToX(
  creds: OAuth1Credentials,
  bytes: Uint8Array,
  contentType: string
): Promise<MediaRef | null> {
  const isVideo = contentType.startsWith("video/");
  try {
    const init = new FormData();
    init.set("command", "INIT");
    init.set("media_type", contentType);
    init.set("total_bytes", String(bytes.byteLength));
    init.set("media_category", isVideo ? "tweet_video" : "tweet_image");
    const initRes = await xUploadFetch(creds, init);
    // v2 nests the id under `data`; v1.1 returned it flat. Accept both rather than break on a
    // response-shape change we would only discover in production.
    const mediaId = String(initRes?.data?.id ?? initRes?.media_id_string ?? initRes?.id ?? "");
    if (!mediaId) throw new Error(`INIT no devolvió media_id: ${JSON.stringify(initRes).slice(0, 200)}`);

    for (let offset = 0, segment = 0; offset < bytes.byteLength; offset += CHUNK_BYTES, segment++) {
      const chunk = bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, bytes.byteLength));
      const append = new FormData();
      append.set("command", "APPEND");
      append.set("media_id", mediaId);
      append.set("segment_index", String(segment));
      append.set("media", new Blob([chunk], { type: "application/octet-stream" }), "chunk");
      await xUploadFetch(creds, append);
    }

    const finalize = new FormData();
    finalize.set("command", "FINALIZE");
    finalize.set("media_id", mediaId);
    const finalizeRes = await xUploadFetch(creds, finalize);

    // Video is transcoded asynchronously and a post referencing a still-processing media_id is
    // rejected. Images finalize with no processing_info at all, so this loop simply never runs
    // for them.
    let info = finalizeRes?.data?.processing_info ?? finalizeRes?.processing_info;
    let waited = 0;
    while (info && (info.state === "pending" || info.state === "in_progress")) {
      const wait = Math.max(1, Number(info.check_after_secs ?? 5));
      // Five minutes. A 60-second clip transcodes in seconds; anything past this is stuck, and
      // the post goes out as text rather than holding the queue behind it.
      if ((waited += wait) > 300) throw new Error("el transcodificado de X no terminó a tiempo");
      await new Promise((r) => setTimeout(r, wait * 1000));
      const status = await xUploadStatus(creds, mediaId);
      info = status?.data?.processing_info ?? status?.processing_info;
      if (info?.state === "failed") {
        throw new Error(`X falló al procesar: ${JSON.stringify(info.error ?? {}).slice(0, 200)}`);
      }
    }

    return { id: mediaId };
  } catch (err) {
    console.error("subida de media a X falló:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// LinkedIn
// ---------------------------------------------------------------------------------------------

const LI_VERSION = "202601";

function liHeaders(accessToken: string): Record<string, string> {
  return {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    "LinkedIn-Version": LI_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

async function uploadImageToLinkedIn(
  accessToken: string,
  ownerUrn: string,
  bytes: Uint8Array
): Promise<MediaRef | null> {
  const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: liHeaders(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });
  if (!initRes.ok) throw new Error(`LinkedIn images init ${initRes.status}: ${(await initRes.text()).slice(0, 300)}`);
  const init: any = await initRes.json();
  const uploadUrl = init?.value?.uploadUrl;
  const urn = init?.value?.image;
  if (!uploadUrl || !urn) throw new Error("LinkedIn no devolvió uploadUrl/image");

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream" },
    body: bytes,
  });
  if (!put.ok) throw new Error(`LinkedIn image PUT ${put.status}`);
  return { id: urn };
}

async function uploadVideoToLinkedIn(
  accessToken: string,
  ownerUrn: string,
  bytes: Uint8Array
): Promise<MediaRef | null> {
  const initRes = await fetch("https://api.linkedin.com/rest/videos?action=initializeUpload", {
    method: "POST",
    headers: liHeaders(accessToken),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: ownerUrn,
        fileSizeBytes: bytes.byteLength,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  if (!initRes.ok) throw new Error(`LinkedIn videos init ${initRes.status}: ${(await initRes.text()).slice(0, 300)}`);
  const init: any = await initRes.json();
  const urn = init?.value?.video;
  const uploadToken = init?.value?.uploadToken ?? "";
  const instructions: any[] = init?.value?.uploadInstructions ?? [];
  if (!urn || instructions.length === 0) throw new Error("LinkedIn no devolvió instrucciones de subida");

  // The byte ranges come from LinkedIn, not from us -- the part boundaries are theirs and
  // finalizeUpload matches the ETags against them in order. Slicing by our own CHUNK_BYTES here
  // would line up by accident today and break the day they change the part size.
  const partIds: string[] = [];
  for (const part of instructions) {
    const slice = bytes.subarray(Number(part.firstByte), Number(part.lastByte) + 1);
    const put = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: slice,
    });
    if (!put.ok) throw new Error(`LinkedIn video PUT ${put.status}`);
    const etag = put.headers.get("etag");
    if (!etag) throw new Error("LinkedIn no devolvió ETag en una parte");
    partIds.push(etag.replace(/^"|"$/g, ""));
  }

  const finalizeRes = await fetch("https://api.linkedin.com/rest/videos?action=finalizeUpload", {
    method: "POST",
    headers: liHeaders(accessToken),
    body: JSON.stringify({ finalizeUploadRequest: { video: urn, uploadToken, uploadedPartIds: partIds } }),
  });
  if (!finalizeRes.ok) {
    throw new Error(`LinkedIn videos finalize ${finalizeRes.status}: ${(await finalizeRes.text()).slice(0, 300)}`);
  }
  return { id: urn };
}

export async function uploadMediaToLinkedIn(
  accessToken: string,
  ownerUrn: string,
  bytes: Uint8Array,
  contentType: string
): Promise<MediaRef | null> {
  try {
    return contentType.startsWith("video/")
      ? await uploadVideoToLinkedIn(accessToken, ownerUrn, bytes)
      : await uploadImageToLinkedIn(accessToken, ownerUrn, bytes);
  } catch (err) {
    console.error("subida de media a LinkedIn falló:", err);
    return null;
  }
}

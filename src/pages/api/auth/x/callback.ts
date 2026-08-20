import type { APIRoute } from "astro";

export const prerender = false;

// Required by X's Developer Portal to enable "User authentication settings" (needed to
// generate Read+Write OAuth 1.0a tokens) — Larry posts using a static Access Token/Secret
// pair generated directly in the portal, not an interactive per-user authorization flow,
// so this endpoint doesn't need to process anything. It just needs to exist.
export const GET: APIRoute = async () => {
  return new Response("Kilowatto — X app callback. Nothing to do here; credentials are managed in /admin/settings.", {
    headers: { "content-type": "text/plain" },
  });
};

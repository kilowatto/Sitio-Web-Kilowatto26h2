import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { buildAuthenticationOptions } from "../../../../lib/webauthn";

export const prerender = false;

// Public — no session yet, this is how someone signs IN. Usernameless/discoverable
// credential flow (residentKey: required at registration time) so no email is needed
// up front; this is also what powers the silent conditional-UI autofill on /login.
export const GET: APIRoute = async () => {
  const options = await buildAuthenticationOptions(env);
  return new Response(JSON.stringify(options), { headers: { "content-type": "application/json" } });
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runSubscriptionCta, shouldPostCta } from "../../../lib/subscription-cta";

export const prerender = false;

function authed(url: URL): boolean {
  const t = url.searchParams.get("token");
  return t === env.ADMIN_TOKEN || t === env.SCRATCH_TOKEN;
}

export const GET: APIRoute = async ({ url }) => {
  if (!authed(url)) return new Response("unauthorized", { status: 401 });
  return Response.json(await shouldPostCta());
};

export const POST: APIRoute = async ({ url }) => {
  if (!authed(url)) return new Response("unauthorized", { status: 401 });
  return Response.json(await runSubscriptionCta(url.searchParams.get("force") === "1"));
};

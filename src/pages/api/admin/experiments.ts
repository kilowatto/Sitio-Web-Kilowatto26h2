import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { allReports, report, decide } from "../../../lib/experiments";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });
  const key = url.searchParams.get("key");
  return Response.json(key ? await report(key) : await allReports());
};

// Writing a winner down is a POST, never a side effect of reading. A dashboard that decided an
// experiment just by being opened would be a trap.
export const POST: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });
  const key = url.searchParams.get("key");
  if (!key) return new Response("key requerido", { status: 400 });
  return Response.json(await decide(key));
};

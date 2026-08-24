import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  getDownloadTotals,
  getDownloadsByClient,
  getDownloadsByEpisode,
  getDownloadsByCountry,
} from "../../../lib/podcast-downloads";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });
  const days = Number(url.searchParams.get("days") ?? 30);
  const [totals, byClient, byEpisode, byCountry] = await Promise.all([
    getDownloadTotals(days),
    getDownloadsByClient(days),
    getDownloadsByEpisode(days),
    getDownloadsByCountry(days),
  ]);
  return Response.json({ totals, byClient, byEpisode, byCountry });
};

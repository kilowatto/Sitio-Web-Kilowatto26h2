import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { sendAlert, pendingAlerts } from "../../../lib/alerts";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });
  return Response.json({ pending: await pendingAlerts() });
};

export const POST: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });
  const subject = url.searchParams.get("subject") ?? "Prueba de alertas de Kilowatto";
  return Response.json(await sendAlert(subject, "Si estás leyendo esto, el Worker puede mandarte correo cuando algo falle.\n\n— el sistema"));
};

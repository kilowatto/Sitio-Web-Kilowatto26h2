import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { sendAlert, pendingAlerts, clearPendingAlerts } from "../../../lib/alerts";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });
  return Response.json({ pending: await pendingAlerts() });
};

export const POST: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });

  // ?flush=1 drains what could not be delivered while sending was unauthorised, then clears it.
  if (url.searchParams.get("flush") === "1") {
    const queued = await pendingAlerts();
    const results = [];
    for (const a of queued) {
      results.push({ subject: a.subject, ...(await sendAlert(`[retenida] ${a.subject}`, `${a.body}\n\n(Encolada el ${a.at} porque: ${a.reason})`)) });
    }
    if (results.every((r) => r.sent)) await clearPendingAlerts();
    return Response.json({ flushed: results.length, results });
  }

  const subject = url.searchParams.get("subject") ?? "Prueba de alertas de Kilowatto";
  return Response.json(await sendAlert(subject, "Si estás leyendo esto, el Worker puede mandarte correo cuando algo falle.\n\n— el sistema"));
};

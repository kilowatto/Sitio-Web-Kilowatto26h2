import { env } from "cloudflare:workers";

// Sends mail when something breaks, via Cloudflare Email Sending.
//
// Everything automated here has been a dashboard someone had to remember to open, and the
// pattern of this project is that what has to be looked at does not get looked at: the audio
// generation was manual for 52 assets, the reindex never deleted anything for months, and 26
// transcript URLs in the English feed were 404s while a validator called the feed certified.
//
// So the monitor, the render pipeline and the publisher report failures by mail instead. The
// hard part is not sending -- it is sending rarely enough to still be read, which is what the
// dedupe window below is for.

const FROM = "larry@kilowatto.com";
const TO = "larry@kilowatto.com"; // forwarded by Email Routing to Esteban's real inbox

// The same failure repeating every six hours would train anyone to ignore these. One mail per
// distinct subject per day; the dashboard still shows the full picture.
const DEDUPE_HOURS = 24;

function mime(subject: string, body: string): string {
  return [
    `From: Kilowatto <${FROM}>`,
    `To: <${TO}>`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
    "",
  ].join("\r\n");
}

const PENDING_KEY = "alerts_pending";
const MAX_PENDING = 30;

// An alert that cannot be delivered is still an alert. Cloudflare Email Sending needs the domain
// authorised for SENDING, which is separate from Email Routing's receiving and needs Esteban in
// the dashboard -- confirmed live 2026-08-23: "email sending not authorized for subdomain
// 'kilowatto.com'". Until that is on, the alerts queue here so the admin can show them and
// nothing is lost. Dropping them silently would be the worst of the three options.
async function queuePending(subject: string, body: string, reason: string): Promise<string> {
  try {
    const raw = await env.KILOWATTO_KV.get(PENDING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({ at: new Date().toISOString(), subject, body: body.slice(0, 600), reason });
    await env.KILOWATTO_KV.put(PENDING_KEY, JSON.stringify(list.slice(0, MAX_PENDING)));
    return `encolada (${list.length})`;
  } catch (err: any) {
    return `no se pudo encolar: ${String(err?.message ?? err)}`;
  }
}

export async function pendingAlerts(): Promise<{ at: string; subject: string; body: string; reason: string }[]> {
  try {
    const raw = await env.KILOWATTO_KV.get(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearPendingAlerts(): Promise<void> {
  try {
    await env.KILOWATTO_KV.delete(PENDING_KEY);
  } catch {
    /* nothing to do */
  }
}

export async function sendAlert(subject: string, body: string): Promise<{ sent: boolean; reason: string }> {
  const binding = (env as any).SEND_EMAIL;
  if (!binding) {
    await queuePending(subject, body, "binding SEND_EMAIL ausente");
    return { sent: false, reason: "binding SEND_EMAIL ausente (dev)" };
  }

  const key = `alert_sent:${subject}`;
  try {
    const last = await env.KILOWATTO_KV.get(key);
    if (last && Date.now() - Number(last) < DEDUPE_HOURS * 3600 * 1000) {
      return { sent: false, reason: "ya avisado en las últimas 24 h" };
    }
  } catch {
    /* if KV is unreachable, erring toward sending is the right side to err on */
  }

  try {
    // EmailMessage comes from cloudflare:email, which only exists inside the Worker runtime.
    const { EmailMessage } = await import("cloudflare:email");
    const msg = new EmailMessage(FROM, TO, mime(subject, body));
    await binding.send(msg);
    await env.KILOWATTO_KV.put(key, String(Date.now()), { expirationTtl: DEDUPE_HOURS * 3600 });
    return { sent: true, reason: "enviado" };
  } catch (err: any) {
    const reason = String(err?.message ?? err);
    const queued = await queuePending(subject, body, reason);
    return { sent: false, reason: `${reason} · ${queued}` };
  }
}

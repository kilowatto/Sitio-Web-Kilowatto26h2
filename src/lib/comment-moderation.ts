// Anonymous commenting, abuse-resistant without accounts: nothing a reader submits becomes
// public until Esteban approves it in /admin/comentarios — that single gate is the real
// defense against abuse/spam. Everything here (rate limit, ban list, spam heuristic) exists
// only to keep his moderation queue itself from filling with junk, not to gate visibility.
const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX = 5;
const MAX_BODY_LENGTH = 2000;
const MAX_NAME_LENGTH = 80;

export async function hashIp(env: any, ip: string): Promise<string> {
  const salt = env.COMMENT_IP_SALT ?? "";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isBanned(env: any, ipHash: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT 1 FROM comment_bans WHERE ip_hash = ?").bind(ipHash).first();
  return !!row;
}

export async function recentCommentCount(env: any, ipHash: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ? AND created_at >= datetime('now', '-${RATE_LIMIT_WINDOW_MINUTES} minutes')`
  )
    .bind(ipHash)
    .first<any>();
  return row?.n ?? 0;
}

export function isRateLimited(count: number): boolean {
  return count >= RATE_LIMIT_MAX;
}

const SPAM_PHRASES = [
  "viagra",
  "casino",
  "crypto giveaway",
  "click here",
  "haz clic aquí",
  "make money fast",
  "gana dinero rápido",
  "seo services",
  "backlinks",
  "loan approval",
  "préstamo aprobado",
];

// Heuristic only — never blocks a submission, just flags it so Esteban can spot likely spam
// at a glance in the moderation queue instead of reading every pending comment word for word.
export function flagSpam(body: string): string | null {
  const lower = body.toLowerCase();
  const urlCount = (body.match(/https?:\/\/\S+/gi) ?? []).length;
  if (urlCount >= 2) return `${urlCount} ligas en el comentario`;
  const phrase = SPAM_PHRASES.find((p) => lower.includes(p));
  if (phrase) return `frase sospechosa: "${phrase}"`;
  if (body.length > 0 && body === body.toUpperCase() && body.length > 40) return "todo en mayúsculas";
  return null;
}

export function sanitizeAuthorName(raw: string | undefined | null): string {
  const trimmed = (raw ?? "").trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || "Anónimo";
}

export function validateBody(raw: string | undefined | null): { ok: true; body: string } | { ok: false; error: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, error: "El comentario está vacío." };
  if (trimmed.length > MAX_BODY_LENGTH) return { ok: false, error: `El comentario supera ${MAX_BODY_LENGTH} caracteres.` };
  return { ok: true, body: trimmed };
}

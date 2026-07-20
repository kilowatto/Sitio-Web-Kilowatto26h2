import type { AstroCookies } from "astro";

const COOKIE_NAME = "kw_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(env: any, userId: number): Promise<string> {
  const token = randomToken();
  await env.SESSION.put(`kw_session:${token}`, JSON.stringify({ userId, createdAt: Date.now() }), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return token;
}

export function setSessionCookie(cookies: AstroCookies, token: string) {
  cookies.set(COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSessionUserId(cookies: AstroCookies, env: any): Promise<number | null> {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const raw = await env.SESSION.get(`kw_session:${token}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw).userId ?? null;
  } catch {
    return null;
  }
}

export async function destroySession(cookies: AstroCookies, env: any) {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (token) await env.SESSION.delete(`kw_session:${token}`);
  cookies.delete(COOKIE_NAME, { path: "/" });
}

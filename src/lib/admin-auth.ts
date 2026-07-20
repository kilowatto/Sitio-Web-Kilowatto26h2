import type { AstroGlobal } from "astro";
import { getSessionUserId } from "./session";

// Real user auth (email+password+passkey, see /login) gates the human entry point.
// On success this returns env.ADMIN_TOKEN unchanged so every existing admin page's
// `define:vars={{ token }}` client-side fetch() calls keep working untouched — only
// the gate itself changed, not how the pages call their own API endpoints.
export async function checkAdminAuth(Astro: AstroGlobal, env: any): Promise<string | null> {
  const userId = await getSessionUserId(Astro.cookies, env);
  if (!userId || !env?.ADMIN_TOKEN) return null;
  return env.ADMIN_TOKEN;
}

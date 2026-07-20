import type { AstroGlobal } from "astro";

// Resolves the admin token from the URL (first visit) or a cookie (every visit after).
// On a valid ?token= it sets the cookie so the token never has to be pasted into the
// URL again — /admin/* pages can just be bookmarked. The resolved token is still what
// gets embedded into the page for client-side fetch() calls, same as before.
export function checkAdminAuth(Astro: AstroGlobal, env: any): string | null {
  const queryToken = Astro.url.searchParams.get("token");
  const cookieToken = Astro.cookies.get("admin_token")?.value ?? null;
  const token = queryToken || cookieToken;
  if (!token || !env?.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return null;

  if (queryToken && queryToken !== cookieToken) {
    Astro.cookies.set("admin_token", queryToken, {
      path: "/admin",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 90,
    });
  }
  return token;
}

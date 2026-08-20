import { env } from "cloudflare:workers";

const SLUG_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/l/I

function randomSlug(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join("");
}

// Own link shortener (kilowatto.com/r/xxxx) instead of bit.ly/etc — keeps click tracking on
// citation sources 100% in our own D1 instead of a third party. brandPostId links back to
// the post so click counts can show up in the post's own report later.
export async function createShortLink(targetUrl: string, brandPostId: number | null): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = randomSlug();
    try {
      await env.DB.prepare("INSERT INTO short_links (slug, target_url, brand_post_id) VALUES (?, ?, ?)")
        .bind(slug, targetUrl, brandPostId)
        .run();
      return `https://kilowatto.com/r/${slug}`;
    } catch (err) {
      // UNIQUE constraint collision on slug — vanishingly rare at 6 chars, just retry.
      continue;
    }
  }
  throw new Error("could not generate a unique short link slug after 5 attempts");
}

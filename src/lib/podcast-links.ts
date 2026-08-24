// Where the show can be listened to, outside the site.
//
// One place, because these URLs appear on the investigación pages, in the feed's own
// description, and eventually in the site footer -- and a directory link that rots in three
// places is worse than one that rots in one.
//
// Apple URLs are the id-only form on purpose. The full URL Apple hands you embeds the show name
// as a slug -- ".../kilowatto-—-columnas-e-investigaciones/id6804514606" -- which is already
// stale, since the show was renamed after publication. The slug is cosmetic and Apple redirects
// from the bare id, so the short form is the one that does not rot.
export interface PodcastPlatform {
  id: "spotify" | "apple";
  name: string;
  url: string | null;
}

export const PODCAST_PLATFORMS: Record<string, PodcastPlatform[]> = {
  "es-MX": [
    { id: "spotify", name: "Spotify", url: "https://open.spotify.com/show/4TJZWDBKrR3ArUGWnSCDjU" },
    { id: "apple", name: "Apple Podcasts", url: "https://podcasts.apple.com/podcast/id6804514606" },
  ],
  en: [
    // The English show is a separate submission with its own id, not a locale of the Spanish one.
    // URLs are stored without Spotify's ?si= share token: that parameter identifies whoever
    // copied the link and is meant to travel with a share, not to be baked into a website.
    { id: "spotify", name: "Spotify", url: "https://open.spotify.com/show/4DyKNoBmRLmfLZUBCKHtYj" },
    // Added to Podcasts Connect as a draft on 2026-08-23 and awaiting review; it has no public
    // page until Apple publishes it, and Apple's id is only assigned then.
    { id: "apple", name: "Apple Podcasts", url: null },
  ],
};

export function platformsFor(locale: string): PodcastPlatform[] {
  return (PODCAST_PLATFORMS[locale] ?? PODCAST_PLATFORMS["es-MX"]).filter((p) => p.url);
}

-- Supports the research-assisted "idea compositor": Esteban gives a rough idea, Larry
-- searches the web, writes the post grounded in what it found, cites sources as short
-- tracked links, and illustrates it with Larry (the mascot) doing something related.

ALTER TABLE brand_posts ADD COLUMN sources TEXT; -- JSON array of {title, url, shortUrl}
ALTER TABLE brand_posts ADD COLUMN idea_prompt TEXT; -- Esteban's original free-form idea, if this post came from one

CREATE TABLE short_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  target_url TEXT NOT NULL,
  brand_post_id INTEGER REFERENCES brand_posts(id),
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

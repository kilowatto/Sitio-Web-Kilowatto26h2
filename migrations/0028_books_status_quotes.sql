-- Ownership status + series/reading-order metadata, for author-collection tracking (e.g. the
-- full Rick Riordan bibliography) alongside the general personal-library catalog.
ALTER TABLE books ADD COLUMN status TEXT NOT NULL DEFAULT 'tengo';
ALTER TABLE books ADD COLUMN series TEXT;
ALTER TABLE books ADD COLUMN reading_order INTEGER;

-- Quote cards to intersperse in the masonry grid — either Esteban's own comment on a book,
-- or a well-known quote from the book itself. book_id is nullable (a quote can stand alone).
CREATE TABLE IF NOT EXISTS book_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER REFERENCES books(id),
  quote_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'libro', -- 'esteban' | 'libro'
  attributed_to TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Existing 12 rows default to status='tengo' already via column default; explicit for clarity.
UPDATE books SET status = 'tengo' WHERE status IS NULL;

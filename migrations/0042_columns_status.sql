-- Status gate for AI-drafted columns (the new autonomous generator) — existing 17 rows are
-- all real, already-published pieces, so they default straight to 'published'. New AI drafts
-- get inserted as 'pending_approval' and never appear on public pages until a human approves.
ALTER TABLE columns ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
CREATE INDEX idx_columns_status ON columns(status);

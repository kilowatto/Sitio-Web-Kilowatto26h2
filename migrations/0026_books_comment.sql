-- Personal commentary field, distinct from the factual `summary` — Esteban's own take on the
-- book, shown alongside it. Optional; most existing rows will be NULL until edited.
ALTER TABLE books ADD COLUMN comment TEXT;

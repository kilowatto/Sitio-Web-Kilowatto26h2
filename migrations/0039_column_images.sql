-- Three accompanying images per column: an AI-generated cover (editorial illustration, no
-- Larry/mascot branding — this is a different register than social-media brand posts), a
-- code-generated infographic (real numbers, not AI-drawn text), and a second AI illustration
-- for a key metaphor/moment in the piece.
ALTER TABLE columns ADD COLUMN cover_r2_key TEXT;
ALTER TABLE columns ADD COLUMN infographic_r2_key TEXT;
ALTER TABLE columns ADD COLUMN illustration_r2_key TEXT;

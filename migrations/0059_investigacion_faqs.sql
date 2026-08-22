-- FAQ per investigación, for GEO/AI-Overview citability (FAQPage JSON-LD) and a real
-- visible on-page FAQ section -- see docs/investigaciones-spec.md's "Traducción e idiomas"
-- section. AI-generated at approval time, grounded strictly in the piece's own body/sources
-- (see src/lib/investigacion-faq.ts), same "reject to redo" editorial flow as the rest of
-- the piece rather than a dedicated admin editor.
CREATE TABLE investigacion_faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investigacion_id INTEGER NOT NULL REFERENCES investigaciones(id),
  position INTEGER NOT NULL DEFAULT 0,
  question TEXT NOT NULL,
  answer_html TEXT NOT NULL
);

CREATE INDEX idx_investigacion_faqs_investigacion ON investigacion_faqs(investigacion_id, position);

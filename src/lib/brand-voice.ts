import { stripHtml } from "./html-text";

// Shared context builder for the personal-brand post generator — pulls real voice
// samples + known bio facts so drafts sound like Esteban, not like a generic AI CEO.

export const FORBIDDEN_TOPICS_NOTE = `Reglas estrictas, nunca las rompas:
- Nunca menciones ni insinúes si Esteban tiene hijos o no.
- Nunca menciones a ex-socios o empresas con las que ya no tiene relación (ej. Octapus).
- Nunca hables de política ni religión.
- Fútbol: SOLO Pumas UNAM, y solo para celebrar triunfos — nunca enojo/crítica cuando pierden. Nada de otros equipos o ligas.
- Nunca alcohol, armas, ni contenido sexual.
- Como inversionista (Orange Rhino Investments), nunca uses lenguaje que suene a asesoría o solicitud de inversión ("deberías invertir en X", rendimientos específicos, "consejo financiero"). Solo opiniones/experiencias personales.`;

export async function buildVoiceContext(DB: any) {
  const [samples, columnSamples, investigacionRows, profile, companies, investments] = await Promise.all([
    DB.prepare("SELECT platform, content FROM social_posts ORDER BY posted_at DESC LIMIT 15").all(),
    DB.prepare("SELECT title, subtitle, body_html FROM columns ORDER BY published_at DESC LIMIT 6").all(),
    DB.prepare("SELECT id, title, summary, body_html FROM investigaciones WHERE status = 'published' ORDER BY published_at DESC LIMIT 2").all(),
    DB.prepare("SELECT * FROM profile WHERE id = 1").first(),
    DB.prepare("SELECT name, role, summary, is_current FROM companies ORDER BY sort_order").all(),
    DB.prepare("SELECT name, category, summary FROM investments ORDER BY sort_order").all(),
  ]);

  const voiceSamples = (samples?.results ?? [])
    .map((s: any) => `[${s.platform}] "${s.content}"`)
    .join("\n");

  // Full body_html would blow up the prompt (columns run 4-9k chars) — an opening excerpt is
  // enough to carry tone/register, which is all this block is for (bioFacts below still grounds
  // actual claims). Kept separate from voiceSamples (short-post shape) since it's a different
  // register — long-form columns read differently than a punchy X post.
  const columnVoiceSamples = (columnSamples?.results ?? [])
    .map((c: any) => {
      const excerpt = stripHtml(c.body_html).slice(0, 500);
      return `[columna] "${c.title}"${c.subtitle ? ` — ${c.subtitle}` : ""}\n${excerpt}...`;
    })
    .join("\n\n");

  const bioFacts = {
    profile: profile ? { display_name: profile.display_name, bio_short: profile.bio_short } : null,
    companies: companies?.results ?? [],
    investments: investments?.results ?? [],
  };

  // "A fondo" pieces need to be known "a detalle" (Esteban's explicit requirement) so Larry
  // can cite real numbers, not just tone/register like columnVoiceSamples above -- these are
  // Esteban's own investigative work, not AI-generated, so a much bigger excerpt is safe to
  // trust. 4000 chars/piece × 2 pieces keeps this from dwarfing the rest of the prompt while
  // still carrying real citable data (most "Gráfica N" data points land inside that range).
  const investigacionSamples = (investigacionRows?.results ?? [])
    .map((r: any) => {
      const excerpt = stripHtml(r.body_html).slice(0, 4000);
      return `[a fondo] "${r.title}"\nResumen: ${r.summary}\nCuerpo (extracto con datos citables): ${excerpt}...`;
    })
    .join("\n\n");

  return { voiceSamples, columnVoiceSamples, investigacionSamples, bioFacts };
}

export function voicePromptBlock(voiceSamples: string, bioFacts: any, columnVoiceSamples?: string, investigacionSamples?: string) {
  return `Ejemplos REALES de cómo escribe Esteban Rey (@Kilowatto) — imita este registro, no un tono genérico de "CEO de LinkedIn":
${voiceSamples || "(sin ejemplos guardados todavía — usa un tono directo, técnico cuando aplique, seguro de sí mismo, ocasionalmente informal/humano, nunca corporativo-genérico)"}
${
  columnVoiceSamples
    ? `\nEjemplos de sus columnas largas de opinión (mismo autor, registro más extenso — úsalos para tono/estructura si estás escribiendo algo largo):\n${columnVoiceSamples}\n`
    : ""
}
${
  investigacionSamples
    ? `\nInvestigaciones "A fondo" recientes (piezas largas, investigadas por el propio Esteban, con decenas de fuentes verificadas cada una). Si el post que vas a escribir menciona o promociona una de estas, puedes y debes citar datos, cifras y hallazgos REALES de aquí — no los inventes ni los redondees de forma distinta a como aparecen. Si el post no tiene relación con ninguna de estas, ignóralas:\n${investigacionSamples}\n`
    : ""
}
Hechos reales verificados sobre Esteban (nunca inventes datos, fechas o logros fuera de esto):
${JSON.stringify(bioFacts, null, 2)}

${FORBIDDEN_TOPICS_NOTE}`;
}

// Learning-from-feedback lives in src/lib/brand-learning.ts now (Vectorize-backed,
// topic-relevance-ranked) — this file used to have a flat SQL "last 8 rows" version with
// no relevance ranking, replaced 2026-07-20.

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
  const [samples, profile, companies, investments] = await Promise.all([
    DB.prepare("SELECT platform, content FROM social_posts ORDER BY posted_at DESC LIMIT 15").all(),
    DB.prepare("SELECT * FROM profile WHERE id = 1").first(),
    DB.prepare("SELECT name, role, summary, is_current FROM companies ORDER BY sort_order").all(),
    DB.prepare("SELECT name, category, summary FROM investments ORDER BY sort_order").all(),
  ]);

  const voiceSamples = (samples?.results ?? [])
    .map((s: any) => `[${s.platform}] "${s.content}"`)
    .join("\n");

  const bioFacts = {
    profile: profile ? { display_name: profile.display_name, bio_short: profile.bio_short } : null,
    companies: companies?.results ?? [],
    investments: investments?.results ?? [],
  };

  return { voiceSamples, bioFacts };
}

export function voicePromptBlock(voiceSamples: string, bioFacts: any) {
  return `Ejemplos REALES de cómo escribe Esteban Rey (@Kilowatto) — imita este registro, no un tono genérico de "CEO de LinkedIn":
${voiceSamples || "(sin ejemplos guardados todavía — usa un tono directo, técnico cuando aplique, seguro de sí mismo, ocasionalmente informal/humano, nunca corporativo-genérico)"}

Hechos reales verificados sobre Esteban (nunca inventes datos, fechas o logros fuera de esto):
${JSON.stringify(bioFacts, null, 2)}

${FORBIDDEN_TOPICS_NOTE}`;
}

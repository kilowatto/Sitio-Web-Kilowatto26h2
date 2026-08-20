// First formal employment (Gerente de Sistemas, Universidad Latinoamericana) — used to compute a
// live "X+ años de experiencia" figure for the CV so it never goes stale, same pattern as the
// ostrich age counter in pet-age.ts.
export const CAREER_START_DATE = "2000-01-01";

const YEAR_WORDS: Record<string, { year: string; years: string }> = {
  "es-MX": { year: "año", years: "años" },
  "es-AR": { year: "año", years: "años" },
  "es-CO": { year: "año", years: "años" },
  "es-ES": { year: "año", years: "años" },
  "es-419": { year: "año", years: "años" },
  en: { year: "year", years: "years" },
};

export function careerYears(startDateIso: string = CAREER_START_DATE, now: Date = new Date()): number {
  const start = new Date(startDateIso);
  let years = now.getUTCFullYear() - start.getUTCFullYear();
  const beforeAnniversary =
    now.getUTCMonth() < start.getUTCMonth() ||
    (now.getUTCMonth() === start.getUTCMonth() && now.getUTCDate() < start.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return years;
}

export function formatCareerYears(locale: string, startDateIso: string = CAREER_START_DATE, now: Date = new Date()): string {
  const words = YEAR_WORDS[locale] ?? YEAR_WORDS["es-MX"];
  const years = careerYears(startDateIso, now);
  return `${years}+ ${years === 1 ? words.year : words.years}`;
}

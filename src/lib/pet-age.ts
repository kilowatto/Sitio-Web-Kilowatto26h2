// Luke & Leia arrived at ~2 months old; this is their birth date, used to compute a
// live "X años Y meses" age so the /avestruces copy never goes stale.
export const OSTRICH_BIRTH_DATE = "2025-04-23";

const AGE_WORDS: Record<string, { year: string; years: string; month: string; months: string; and: string; noAnd?: boolean }> = {
  "es-MX": { year: "año", years: "años", month: "mes", months: "meses", and: "y" },
  "es-AR": { year: "año", years: "años", month: "mes", months: "meses", and: "y" },
  "es-CO": { year: "año", years: "años", month: "mes", months: "meses", and: "y" },
  "es-ES": { year: "año", years: "años", month: "mes", months: "meses", and: "y" },
  "es-419": { year: "año", years: "años", month: "mes", months: "meses", and: "y" },
  en: { year: "year", years: "years", month: "month", months: "months", and: "and" },
  "pt-BR": { year: "ano", years: "anos", month: "mês", months: "meses", and: "e" },
  fr: { year: "an", years: "ans", month: "mois", months: "mois", and: "et" },
  de: { year: "Jahr", years: "Jahre", month: "Monat", months: "Monate", and: "und" },
  ar: { year: "سنة", years: "سنوات", month: "شهر", months: "أشهر", and: "و" },
  "zh-Hans": { year: "岁", years: "岁", month: "个月", months: "个月", and: "", noAnd: true },
  ja: { year: "歳", years: "歳", month: "ヶ月", months: "ヶ月", and: "", noAnd: true },
};

function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function formatAge(locale: string, birthDateIso: string = OSTRICH_BIRTH_DATE, now: Date = new Date()): string {
  const words = AGE_WORDS[locale] ?? AGE_WORDS["es-MX"];
  const birth = new Date(birthDateIso);

  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  let months = now.getUTCMonth() - birth.getUTCMonth();
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (locale === "zh-Hans" || locale === "ja") {
    return months > 0 ? `${years}${words.years}${months}${words.months}` : `${years}${words.years}`;
  }

  const yearPart = `${years} ${pluralize(years, words.year, words.years)}`;
  const monthPart = months > 0 ? `${months} ${pluralize(months, words.month, words.months)}` : "";
  return monthPart ? `${yearPart} ${words.and} ${monthPart}` : yearPart;
}

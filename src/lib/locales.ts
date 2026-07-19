export const LOCALES = [
  { code: "es-MX", name: "Español (México)", canonical: true, rtl: false },
  { code: "es-AR", name: "Español (Argentina)", canonical: false, rtl: false },
  { code: "es-CO", name: "Español (Colombia)", canonical: false, rtl: false },
  { code: "es-ES", name: "Español (España)", canonical: false, rtl: false },
  { code: "es-419", name: "Español (Latinoamérica)", canonical: false, rtl: false },
  { code: "en", name: "English", canonical: false, rtl: false },
  { code: "pt-BR", name: "Português (Brasil)", canonical: false, rtl: false },
  { code: "fr", name: "Français", canonical: false, rtl: false },
  { code: "de", name: "Deutsch", canonical: false, rtl: false },
  { code: "ar", name: "العربية", canonical: false, rtl: true },
  { code: "zh-Hans", name: "中文", canonical: false, rtl: false },
  { code: "ja", name: "日本語", canonical: false, rtl: false },
] as const;

export const NON_CANONICAL_LOCALES = LOCALES.filter((l) => !l.canonical);

export const VOICE_INSTRUCTIONS: Record<string, string> = {
  "es-AR": "Traduce a español rioplatense con voseo natural (vos tenés, en vez de tú tienes). Tono cercano.",
  "es-CO": "Traduce a español colombiano neutro, tono cálido y formal-cercano.",
  "es-ES": "Traduce a español ibérico (vosotros/vale/tío cuando encaje natural), tono directo.",
  "es-419": "Traduce a español latinoamericano neutro, sin modismos de un país específico.",
  en: "Translate to natural, confident English — American tech-industry register, not overly formal.",
  "pt-BR": "Traduza para português do Brasil natural, tom próximo e direto.",
  fr: "Traduis en français naturel et professionnel, sans formules trop rigides.",
  de: "Übersetze ins Deutsche, klar und professionell, nicht übermäßig förmlich.",
  ar: "ترجم إلى العربية الفصحى الحديثة بأسلوب واضح ومهني.",
  "zh-Hans": "翻译成简体中文，语气自然、专业、不生硬。",
  ja: "自然でプロフェッショナルな日本語に翻訳してください。過度に硬い敬語は避けてください。",
};

export function localeFromParam(param: string | undefined) {
  return LOCALES.find((l) => l.code.toLowerCase() === (param ?? "").toLowerCase());
}

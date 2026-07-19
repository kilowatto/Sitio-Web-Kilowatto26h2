export const NAV_LABELS: Record<string, Record<string, string>> = {
  "es-MX": { trayectoria: "Trayectoria", empresas: "Empresas", inversiones: "Inversiones", yucatech: "Yucatech", prensa: "Prensa", familia: "Familia", galeria: "Galería" },
  "es-AR": { trayectoria: "Trayectoria", empresas: "Empresas", inversiones: "Inversiones", yucatech: "Yucatech", prensa: "Prensa", familia: "Familia", galeria: "Galería" },
  "es-CO": { trayectoria: "Trayectoria", empresas: "Empresas", inversiones: "Inversiones", yucatech: "Yucatech", prensa: "Prensa", familia: "Familia", galeria: "Galería" },
  "es-ES": { trayectoria: "Trayectoria", empresas: "Empresas", inversiones: "Inversiones", yucatech: "Yucatech", prensa: "Prensa", familia: "Familia", galeria: "Galería" },
  "es-419": { trayectoria: "Trayectoria", empresas: "Empresas", inversiones: "Inversiones", yucatech: "Yucatech", prensa: "Prensa", familia: "Familia", galeria: "Galería" },
  en: { trayectoria: "Timeline", empresas: "Companies", inversiones: "Investments", yucatech: "Yucatech", prensa: "Press", familia: "Family", galeria: "Gallery" },
  "pt-BR": { trayectoria: "Trajetória", empresas: "Empresas", inversiones: "Investimentos", yucatech: "Yucatech", prensa: "Imprensa", familia: "Família", galeria: "Galeria" },
  fr: { trayectoria: "Parcours", empresas: "Entreprises", inversiones: "Investissements", yucatech: "Yucatech", prensa: "Presse", familia: "Famille", galeria: "Galerie" },
  de: { trayectoria: "Werdegang", empresas: "Unternehmen", inversiones: "Investitionen", yucatech: "Yucatech", prensa: "Presse", familia: "Familie", galeria: "Galerie" },
  ar: { trayectoria: "المسيرة", empresas: "الشركات", inversiones: "الاستثمارات", yucatech: "يوكاتك", prensa: "الصحافة", familia: "العائلة", galeria: "معرض الصور" },
  "zh-Hans": { trayectoria: "历程", empresas: "公司", inversiones: "投资", yucatech: "Yucatech", prensa: "新闻", familia: "家庭", galeria: "相册" },
  ja: { trayectoria: "経歴", empresas: "会社", inversiones: "投資", yucatech: "Yucatech", prensa: "プレス", familia: "家族", galeria: "ギャラリー" },
};

export function navLabels(locale: string) {
  return NAV_LABELS[locale] ?? NAV_LABELS["es-MX"];
}

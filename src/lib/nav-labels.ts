export const NAV_LABELS: Record<string, Record<string, string>> = {
  "es-MX": { trayectoria: "Trayectoria", empresas: "Empresas", inversiones: "Inversiones", yucatech: "Yucatech", prensa: "Prensa", columnas: "Columnas", curiosidades: "Curiosidades", galeria: "Galería", avestruces: "Pandilla Jedi", comida: "Comida", podcast: "Podcast", a_fondo: "A fondo", contacto: "Contacto" },
  "es-AR": { trayectoria: "Trayectoria", empresas: "Empresas", inversiones: "Inversiones", yucatech: "Yucatech", prensa: "Prensa", columnas: "Columnas", curiosidades: "Curiosidades", galeria: "Galería", avestruces: "Pandilla Jedi", comida: "Comida", podcast: "Podcast", a_fondo: "A fondo", contacto: "Contacto" },
  "es-CO": { trayectoria: "Trayectoria", empresas: "Empresas", inversiones: "Inversiones", yucatech: "Yucatech", prensa: "Prensa", columnas: "Columnas", curiosidades: "Curiosidades", galeria: "Galería", avestruces: "Pandilla Jedi", comida: "Comida", podcast: "Podcast", a_fondo: "A fondo", contacto: "Contacto" },
  "es-ES": { trayectoria: "Trayectoria", empresas: "Empresas", inversiones: "Inversiones", yucatech: "Yucatech", prensa: "Prensa", columnas: "Columnas", curiosidades: "Curiosidades", galeria: "Galería", avestruces: "Pandilla Jedi", comida: "Comida", podcast: "Podcast", a_fondo: "A fondo", contacto: "Contacto" },
  "es-419": { trayectoria: "Trayectoria", empresas: "Empresas", inversiones: "Inversiones", yucatech: "Yucatech", prensa: "Prensa", columnas: "Columnas", curiosidades: "Curiosidades", galeria: "Galería", avestruces: "Pandilla Jedi", comida: "Comida", podcast: "Podcast", a_fondo: "A fondo", contacto: "Contacto" },
  en: { trayectoria: "Timeline", empresas: "Companies", inversiones: "Investments", yucatech: "Yucatech", prensa: "Press", columnas: "Columns", curiosidades: "Curiosities", galeria: "Gallery", avestruces: "Jedi Squad", comida: "Food", podcast: "Podcast", a_fondo: "Deep Dives", contacto: "Contact" },
  "pt-BR": { trayectoria: "Trajetória", empresas: "Empresas", inversiones: "Investimentos", yucatech: "Yucatech", prensa: "Imprensa", columnas: "Colunas", curiosidades: "Curiosidades", galeria: "Galeria", avestruces: "Turma Jedi", comida: "Comida", podcast: "Podcast", a_fondo: "A fundo", contacto: "Contato" },
  fr: { trayectoria: "Parcours", empresas: "Entreprises", inversiones: "Investissements", yucatech: "Yucatech", prensa: "Presse", columnas: "Chroniques", curiosidades: "Anecdotes", galeria: "Galerie", avestruces: "Bande de Jedi", comida: "Cuisine", podcast: "Podcast", a_fondo: "En profondeur", contacto: "Contact" },
  de: { trayectoria: "Werdegang", empresas: "Unternehmen", inversiones: "Investitionen", yucatech: "Yucatech", prensa: "Presse", columnas: "Kolumnen", curiosidades: "Kurioses", galeria: "Galerie", avestruces: "Jedi-Bande", comida: "Essen", podcast: "Podcast", a_fondo: "Im Detail", contacto: "Kontakt" },
  ar: { trayectoria: "المسيرة", empresas: "الشركات", inversiones: "الاستثمارات", yucatech: "يوكاتك", prensa: "الصحافة", columnas: "مقالات", curiosidades: "طرائف", galeria: "معرض الصور", avestruces: "عصابة الجيداي", comida: "الطعام", podcast: "بودكاست", a_fondo: "بعمق", contacto: "اتصل بنا" },
  "zh-Hans": { trayectoria: "历程", empresas: "公司", inversiones: "投资", yucatech: "Yucatech", prensa: "新闻", columnas: "专栏", curiosidades: "趣闻", galeria: "相册", avestruces: "绝地帮", comida: "美食", podcast: "播客", a_fondo: "深度报道", contacto: "联系" },
  ja: { trayectoria: "経歴", empresas: "会社", inversiones: "投資", yucatech: "Yucatech", prensa: "プレス", columnas: "コラム", curiosidades: "こぼれ話", galeria: "ギャラリー", avestruces: "ジェダイ団", comida: "グルメ", podcast: "ポッドキャスト", a_fondo: "徹底調査", contacto: "お問い合わせ" },
};

export function navLabels(locale: string) {
  return NAV_LABELS[locale] ?? NAV_LABELS["es-MX"];
}

// Nav category labels for the mega-menu/overlay taxonomy — hand-translated, same convention as
// NAV_LABELS above (not run through the AI translation pipeline, fixed chrome text).
export const CATEGORY_LABELS: Record<string, { personal: string; negocios: string; medios: string }> = {
  "es-MX": { personal: "Personal", negocios: "Negocios y proyectos", medios: "Medios" },
  "es-AR": { personal: "Personal", negocios: "Negocios y proyectos", medios: "Medios" },
  "es-CO": { personal: "Personal", negocios: "Negocios y proyectos", medios: "Medios" },
  "es-ES": { personal: "Personal", negocios: "Negocios y proyectos", medios: "Medios" },
  "es-419": { personal: "Personal", negocios: "Negocios y proyectos", medios: "Medios" },
  en: { personal: "Personal", negocios: "Business & Projects", medios: "Media" },
  "pt-BR": { personal: "Pessoal", negocios: "Negócios e projetos", medios: "Mídia" },
  fr: { personal: "Personnel", negocios: "Entreprises et projets", medios: "Médias" },
  de: { personal: "Persönliches", negocios: "Unternehmen und Projekte", medios: "Medien" },
  ar: { personal: "شخصي", negocios: "الأعمال والمشاريع", medios: "الإعلام" },
  "zh-Hans": { personal: "个人", negocios: "业务与项目", medios: "媒体" },
  ja: { personal: "個人", negocios: "事業とプロジェクト", medios: "メディア" },
};

export function categoryLabels(locale: string) {
  return CATEGORY_LABELS[locale] ?? CATEGORY_LABELS["es-MX"];
}

// Accessibility strings for the nav (skip link, menu open/close, language-switcher section
// inside the mobile overlay) — same hand-translated convention.
export const NAV_A11Y_LABELS: Record<string, { skipToContent: string; openMenu: string; closeMenu: string; language: string }> = {
  "es-MX": { skipToContent: "Saltar al contenido", openMenu: "Abrir menú", closeMenu: "Cerrar menú", language: "Idioma" },
  "es-AR": { skipToContent: "Saltar al contenido", openMenu: "Abrir menú", closeMenu: "Cerrar menú", language: "Idioma" },
  "es-CO": { skipToContent: "Saltar al contenido", openMenu: "Abrir menú", closeMenu: "Cerrar menú", language: "Idioma" },
  "es-ES": { skipToContent: "Saltar al contenido", openMenu: "Abrir menú", closeMenu: "Cerrar menú", language: "Idioma" },
  "es-419": { skipToContent: "Saltar al contenido", openMenu: "Abrir menú", closeMenu: "Cerrar menú", language: "Idioma" },
  en: { skipToContent: "Skip to content", openMenu: "Open menu", closeMenu: "Close menu", language: "Language" },
  "pt-BR": { skipToContent: "Pular para o conteúdo", openMenu: "Abrir menu", closeMenu: "Fechar menu", language: "Idioma" },
  fr: { skipToContent: "Passer au contenu", openMenu: "Ouvrir le menu", closeMenu: "Fermer le menu", language: "Langue" },
  de: { skipToContent: "Zum Inhalt springen", openMenu: "Menü öffnen", closeMenu: "Menü schließen", language: "Sprache" },
  ar: { skipToContent: "تخطَّ إلى المحتوى", openMenu: "افتح القائمة", closeMenu: "أغلق القائمة", language: "اللغة" },
  "zh-Hans": { skipToContent: "跳转到内容", openMenu: "打开菜单", closeMenu: "关闭菜单", language: "语言" },
  ja: { skipToContent: "コンテンツへスキップ", openMenu: "メニューを開く", closeMenu: "メニューを閉じる", language: "言語" },
};

export function navA11yLabels(locale: string) {
  return NAV_A11Y_LABELS[locale] ?? NAV_A11Y_LABELS["es-MX"];
}

// Static UI copy for the "Mis proyectos" section (home + /empresas) — hand-translated like
// NAV_LABELS above, not run through the AI translation pipeline since it's fixed chrome text,
// not per-row database content.
export const PROJECTS_LABELS: Record<string, { eyebrow: string; heading: string }> = {
  "es-MX": { eyebrow: "Mis proyectos", heading: "En vivo, ahora mismo." },
  "es-AR": { eyebrow: "Mis proyectos", heading: "En vivo, ahora mismo." },
  "es-CO": { eyebrow: "Mis proyectos", heading: "En vivo, ahora mismo." },
  "es-ES": { eyebrow: "Mis proyectos", heading: "En vivo, ahora mismo." },
  "es-419": { eyebrow: "Mis proyectos", heading: "En vivo, ahora mismo." },
  en: { eyebrow: "My projects", heading: "Live, right now." },
  "pt-BR": { eyebrow: "Meus projetos", heading: "Ao vivo, agora mesmo." },
  fr: { eyebrow: "Mes projets", heading: "En direct, maintenant." },
  de: { eyebrow: "Meine Projekte", heading: "Live, gerade jetzt." },
  ar: { eyebrow: "مشاريعي", heading: "مباشر، الآن." },
  "zh-Hans": { eyebrow: "我的项目", heading: "实时更新，就在此刻。" },
  ja: { eyebrow: "私のプロジェクト", heading: "ライブ、今この瞬間。" },
};

export function projectsLabels(locale: string) {
  return PROJECTS_LABELS[locale] ?? PROJECTS_LABELS["es-MX"];
}

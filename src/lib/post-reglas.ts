// Las reglas de forma de un post, decididas por Esteban el 2026-08-29/30 en dos rondas de
// preguntas. Viven aquí y no dentro de cada prompt porque hay cuatro generadores distintos
// (investigaciones, columnas, audio, clips) y antes cada uno decía algo distinto sobre lo mismo.

/**
 * Topes duros de longitud.
 *
 * Bajaron de ~230/900 a 120/220 cuando el post pasó a llevar siempre infografía o video: si la
 * imagen ya carga la cifra, el texto es un pie de foto, no un párrafo. Con 291 caracteres de
 * promedio salían cosas como "La pasión es el combustible que impulsa el éxito empresarial" --
 * con 220 no caben.
 */
export const MAX_CHARS: Record<string, number> = { x: 120, linkedin: 220 };

/**
 * Palabras y hábitos vetados, con la razón.
 *
 * Se comprueban DESPUÉS de generar, no solo se piden en el prompt: el modelo trata una
 * instrucción de estilo como sugerencia. Un post que viole esto se descarta y se pide otro.
 */
export const VETADAS: { re: RegExp; porque: string }[] = [
  { re: /\bdescubre\b/i, porque: "relleno de marketing; Esteban lo rechazó dos veces" },
  { re: /no te lo pierdas/i, porque: "relleno de marketing" },
  { re: /\bincre[íi]ble\b/i, porque: "superlativo vacío" },
  { re: /^[\s]*[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u, porque: "emoji de apertura: registro de cuenta corporativa" },
  { re: /#\w/, porque: "hashtag dentro del texto; van en su propio campo" },
  { re: /\b(el|la) (mayor|mejor|peor|m[áa]s grande) (del mundo|de la historia)\b/i, porque: "superlativo sin dato que lo respalde" },
  { re: /\brevolucionari[oa]\b/i, porque: "superlativo sin dato" },
  { re: /^¡/, porque: "exclamación de apertura" },
];

export interface Veredicto {
  ok: boolean;
  motivo?: string;
}

/** Comprueba un post contra los topes y los vetos. */
export function revisarPost(content: string, platform: string): Veredicto {
  const texto = (content ?? "").trim();
  if (!texto) return { ok: false, motivo: "vacío" };

  const max = MAX_CHARS[platform] ?? 220;
  if (texto.length > max) return { ok: false, motivo: `${texto.length} caracteres, el tope es ${max}` };

  for (const v of VETADAS) {
    if (v.re.test(texto)) return { ok: false, motivo: `veto: ${v.porque}` };
  }
  return { ok: true };
}

/**
 * El bloque de instrucciones que va en todos los prompts de generación.
 *
 * El gancho es una pregunta que abre un hueco -- el principio que ya usamos en el podcast: algo
 * que crees saber y no sabes. Y el texto NO repite la cifra que la imagen ya muestra: su trabajo
 * es dar la razón para ir a leer, no resumir la pieza.
 */
export function bloqueDeReglas(platform: string, idioma: "es" | "en"): string {
  const max = MAX_CHARS[platform] ?? 220;
  return `FORMA DEL POST (obligatoria, se verifica después de generar):
- MÁXIMO ${max} caracteres. No es una sugerencia: un post más largo se descarta.
- Idioma: ${idioma === "en" ? "inglés" : "español"}.
- El post lleva SIEMPRE una imagen o un video que ya muestra la cifra. NO repitas la cifra en el
  texto: tu trabajo es dar la razón para ir a leer, no resumir el dato.
- Abre con una PREGUNTA que abra un hueco: algo que el lector cree saber y no sabe. No una
  pregunta retórica de relleno, una que de verdad no pueda contestar sin leer la pieza.
- PROHIBIDO: "descubre", "no te lo pierdas", "increíble", superlativos sin dato que los respalde,
  empezar con emoji, empezar con exclamación, y hashtags dentro del texto.
- Sin link: se agrega aparte.`;
}

import { env } from "cloudflare:workers";

// Convierte una gráfica en infografías cuadradas, una por cifra.
//
// Nace de bajar el texto del post a 120 caracteres en X y 220 en LinkedIn: si el pie ya no puede
// cargar el dato, la imagen tiene que hacerlo sola y leerse en el scroll sin abrirla.
//
// Y resuelve un problema de aritmética que el formato anterior no podía: una columna tiene UNA
// gráfica y necesita ocho posts. De una gráfica de tres barras salen tres infografías, cada una
// con su propia cifra, sin inventar nada -- son los mismos números que ya están en la base y que
// ya se dibujan en la página de la pieza.

// El nombre de la instancia del contenedor. SÚBELE EL NÚMERO cada vez que cambie algo dentro
// de la imagen (la composición, el servidor, las fuentes).
//
// Una instancia viva NO recoge una imagen nueva, y el nombre es lo único que decide si arranca
// una nueva. Costó cinco intentos descubrirlo: "still-v1" ya se había creado con la imagen
// anterior y siguió sirviendo "Cannot POST /still" aunque el despliegue sí había subido la
// imagen con el endpoint dentro.
const STILL_INSTANCE = "still-2";

export interface Figura {
  figure: string;
  eyebrow: string;
  caption: string;
  sourceNote?: string;
}

/**
 * Saca una figura por cada valor de la gráfica, de mayor a menor.
 *
 * Devuelve solo lo que el data_json sostiene: si una barra no trae displayValue se usa su
 * número crudo, y si no trae etiqueta se descarta en vez de inventarle una.
 */
export function figurasDeGrafica(
  dataJson: string,
  eyebrow: string,
  sourceNote?: string | null
): Figura[] {
  let data: any;
  try {
    data = JSON.parse(dataJson);
  } catch {
    return [];
  }

  const items: Array<{ label: string; value: number; display: string }> = [];
  for (const it of data?.items ?? []) {
    const v = it?.values?.[0];
    if (!it?.label || v?.value === undefined) continue;
    items.push({
      label: String(it.label),
      value: Number(v.value),
      display: String(v.displayValue ?? v.value),
    });
  }
  // Las barras más separadas primero: la cifra que mejor se defiende sola encabeza la serie.
  items.sort((a, b) => b.value - a.value);

  return items.map((it) => ({
    figure: it.display,
    eyebrow,
    // La etiqueta de la barra ES el pie: describe qué mide esa cifra y no repite el titular.
    caption: it.label.replace(/\s*\([^)]*\)\s*$/, "").trim(),
    sourceNote: sourceNote ?? undefined,
  }));
}

/** Renderiza una infografía en el contenedor y la deja en R2. Devuelve la clave. */
export async function renderInfografia(fig: Figura, key: string): Promise<string> {
  const binding = (env as any).RENDER;
  if (!binding) throw new Error("falta el service binding RENDER");
  const secret = String((env as any).RENDER_SECRET ?? "");
  if (!secret) throw new Error("falta el secreto RENDER_SECRET");

  const res = await binding.fetch("https://render/still", {
    method: "POST",
    headers: { "content-type": "application/json", "x-render-secret": secret },
    // Instancia propia para los stills, distinta de la de los clips. Dos razones: una instancia
    // viva NO recoge una imagen nueva -- por eso el primer intento respondió "Cannot POST /still"
    // desde el contenedor anterior -- y separar las cargas evita que una infografía de segundos
    // espere detrás de un clip de minutos.
    body: JSON.stringify({ compositionId: "Infografia", key, inputProps: fig, instance: STILL_INSTANCE }),
  });
  if (!res.ok) throw new Error(`still ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return key;
}

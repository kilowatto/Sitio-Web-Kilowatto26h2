import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, FONTS } from "./theme";

// Una cifra, cuadrada, para el feed.
//
// El formato que Esteban pidió cuando decidimos que el texto del post baja a 120 caracteres en X
// y 220 en LinkedIn: si el pie de foto ya no puede cargar el dato, la imagen tiene que hacerlo
// sola y leerse en el scroll sin abrirla.
//
// Estática a propósito, pero renderizada por el mismo contenedor que los clips y con las mismas
// fuentes embebidas, así que el video y la imagen se ven de la misma casa. Una gráfica de tres
// barras da tres infografías, una por cifra -- que es lo que resuelve el hueco de las columnas:
// tienen una sola gráfica y necesitan ocho posts.

export interface InfografiaProps {
  /** La cifra, tal como se muestra: "50x", "96%", "858 TB". */
  figure: string;
  /** Qué es esa cifra. Va arriba, chico. */
  eyebrow: string;
  /** La frase que le da sentido. Va abajo, mediana. */
  caption: string;
  /** De dónde sale. Va al pie, muy chico. */
  sourceNote?: string;
}

export const Infografia: React.FC<InfografiaProps> = ({ figure, eyebrow, caption, sourceNote }) => {
  // La cifra manda: el tamaño se ajusta a su largo para que "96%" y "1,066 GW" ocupen
  // ópticamente lo mismo y ninguna se salga del cuadro.
  const size = figure.length <= 3 ? 400 : figure.length <= 5 ? 320 : figure.length <= 8 ? 230 : 170;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.paper,
        padding: 90,
        fontFamily: FONTS.body,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          font: `700 30px/1.3 ${FONTS.body}`,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: COLORS.rhino,
        }}
      >
        {eyebrow}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            font: `700 ${size}px/0.95 ${FONTS.mono}`,
            color: COLORS.rhino,
            letterSpacing: -4,
          }}
        >
          {figure}
        </div>
        <div style={{ font: `600 44px/1.3 ${FONTS.body}`, color: COLORS.ink }}>{caption}</div>
      </div>

      <div
        style={{
          borderTop: `2px solid ${COLORS.line}`,
          paddingTop: 26,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 24,
        }}
      >
        <span style={{ font: `400 24px/1.4 ${FONTS.body}`, color: COLORS.soft, maxWidth: "70%" }}>
          {sourceNote ?? ""}
        </span>
        <span style={{ font: `700 28px/1 ${FONTS.body}`, color: COLORS.rhino, letterSpacing: 1 }}>
          kilowatto.com
        </span>
      </div>
    </AbsoluteFill>
  );
};

// Lifted from the site's own tokens so a clip looks like kilowatto.com and not like a template.
// These are the compiled values, not var() references: Remotion renders in its own page with no
// access to the site's stylesheet.
export const COLORS = {
  ink: "#141414",
  paper: "#F4F1EC",
  rhino: "#D4541E",
  soft: "rgba(20,20,20,0.62)",
  line: "rgba(20,20,20,0.14)",
  bar: "#D4541E",
  barTrack: "rgba(20,20,20,0.10)",
};

// Las tres familias reales del sitio, empaquetadas en el bundle.
//
// Antes esto eran pilas genéricas (Georgia / system-ui / ui-monospace) con el comentario de que
// "caen limpio". No caen limpio: el contenedor Debian no tiene ninguna de esas, así que todo el
// texto de cuerpo salía en MONOESPACIADA y el titular partía en tres líneas donde en macOS partía
// en cuatro. O sea que el clip aprobado en local no era el clip publicado. Y ninguno de los dos
// se parecía a kilowatto.com, que usa Fraunces, Sora e IBM Plex Mono.
//
// Los .ttf viven en public/fonts y se cargan con delayRender, así que un archivo que falte
// revienta el render en vez de sustituir una fuente en silencio. Van embebidos y no por CDN a
// propósito: un render que depende de fonts.gstatic.com falla el día que la red del contenedor
// se pone lenta, y hoy ya se puso lenta dos veces.
export const FONTS = {
  display: "Fraunces, Georgia, serif",
  body: "Sora, system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};

export const FONT_FILES = [
  { family: "Fraunces", weight: "700", file: "fonts/Fraunces-700.ttf" },
  { family: "Sora", weight: "400", file: "fonts/Sora-400.ttf" },
  { family: "Sora", weight: "500", file: "fonts/Sora-500.ttf" },
  { family: "Sora", weight: "600", file: "fonts/Sora-600.ttf" },
  { family: "Sora", weight: "700", file: "fonts/Sora-700.ttf" },
  { family: "IBM Plex Mono", weight: "700", file: "fonts/IBMPlexMono-700.ttf" },
] as const;

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

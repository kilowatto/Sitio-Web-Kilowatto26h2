import { loadFont } from "@remotion/fonts";
import { staticFile, continueRender, delayRender } from "remotion";
import { FONT_FILES } from "./theme";

// Carga las fuentes ANTES de que se dibuje el primer cuadro.
//
// Remotion renderiza los cuadros en paralelo y fuera de orden, así que "que cargue sola" no
// existe: sin delayRender, unos cuadros saldrían con la fuente y otros con la sustituta, en el
// mismo video. El handle se libera hasta que las seis están listas.
const handle = delayRender("cargando fuentes de la marca");

export const fontsReady = Promise.all(
  FONT_FILES.map((f) => loadFont({ family: f.family, url: staticFile(f.file), weight: f.weight }))
)
  .then(() => continueRender(handle))
  .catch((err) => {
    // A propósito NO se llama continueRender aquí: si una fuente no carga, el render debe
    // fallar y no publicar un clip con la tipografía equivocada.
    console.error("no se pudieron cargar las fuentes:", err);
    throw err;
  });

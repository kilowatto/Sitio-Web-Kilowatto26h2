import React from "react";
import { Composition } from "remotion";
import { Clip, type ClipProps } from "./Clip";
import { Infografia, type InfografiaProps } from "./Infografia";
import { PhotoMontage, type PhotoMontageProps } from "./PhotoMontage";
import { FPS, WIDTH, HEIGHT } from "./theme";
import "./fonts";

// Duration comes from props: Esteban's call is ~30 s for columns and ~75 s for investigaciones,
// and calculateMetadata lets one composition serve both instead of two that drift apart.
export const Root: React.FC = () => (
  <>
  <Composition
    id="Clip"
    component={Clip}
    durationInFrames={30 * FPS}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    // OJO: Remotion FUSIONA estos defaults con los props de entrada, campo por campo. Cualquier
    // valor de aquí que el pipeline no mande se cuela en un clip real -- y pasó: la nota de
    // fuente de este ejemplo ("Auditoría de 100 apps") apareció como la fuente del clip de una
    // columna sobre precios de Fable. Nada aquí puede parecerse a una cita, un dato o una fuente.
    defaultProps={
      {
        eyebrow: "A fondo",
        hook: "El 90% de las VPN gratuitas filtra tus datos.",
        chartTitle: "Lo que encontró la auditoría de 100 VPN gratuitas",
        items: [
          { label: "Filtran algún dato del usuario", value: 90, displayValue: "90%" },
          { label: "Piden permisos sin función legítima", value: 70, displayValue: "70%" },
          { label: "Comparten datos con terceros", value: 50, displayValue: "50%" },
        ],
        sourceNote: "",
        cta: "La investigación completa",
      } satisfies ClipProps
    }
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.round((props.durationSeconds ?? 30) * FPS),
    })}
  />

  {/* A one-off personal clip (see src/lib/rapado-clip.ts) -- same rule as Clip: duration comes
      from props (the sum of every beat's real narration timing), never guessed here. */}
  <Composition
    id="PhotoMontage"
    component={PhotoMontage}
    durationInFrames={30 * FPS}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    defaultProps={
      {
        beats: [
          { imageSrc: "https://kilowatto.com/podcast-cover.jpg?v=2", caption: "Ejemplo", durationSeconds: 3 },
        ],
      } satisfies PhotoMontageProps
    }
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.round((props.durationSeconds ?? 30) * FPS),
    })}
  />

  {/* Cuadrada para el feed: una sola cifra, un cuadro, sin video.
      El formato nace de bajar el texto del post a 120 caracteres en X y 220 en LinkedIn: si el
      pie ya no puede cargar el dato, la imagen tiene que hacerlo sola. Se renderiza en el mismo
      contenedor y con las mismas fuentes que los clips, así que el video y la imagen se ven de
      la misma casa. */}
  <Composition
    id="Infografia"
    component={Infografia}
    durationInFrames={1}
    fps={FPS}
    width={1080}
    height={1080}
    defaultProps={
      {
        figure: "50x",
        eyebrow: "Ejemplo",
        caption: "Texto de ejemplo, se reemplaza siempre por props reales.",
        sourceNote: "",
      } satisfies InfografiaProps
    }
  />
  </>
);

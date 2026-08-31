import React from "react";
import { AbsoluteFill, Audio, Img, Series, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "./theme";

// A vertical photo-montage clip: real photos cut to a script, one <Series.Sequence> per beat so
// each beat's own duration comes straight from how long its slice of the narration actually took
// to say -- nothing here is guessed or hand-timed.
//
// Everything is f(useCurrentFrame()), same rule as Clip.tsx: no Math.random, no Date.now, no CSS
// animation -- Remotion renders frames out of order, so anything else flickers between takes.

export interface MontageBeat {
  /** Full https URL -- a real photo in R2. */
  imageSrc: string;
  /** The line being spoken during this beat, burned in as a caption. */
  caption: string;
  /** How long this beat is on screen, in seconds -- derived from its slice of the narration. */
  durationSeconds: number;
  /** "cover" (default) crops to fill; "contain" letterboxes to show the whole photo. */
  fit?: "cover" | "contain";
}

export interface PhotoMontageProps {
  beats: MontageBeat[];
  audioSrc?: string;
  /** Read by calculateMetadata in Root -- the sum of every beat's durationSeconds. */
  durationSeconds?: number;
}

const Beat: React.FC<{ beat: MontageBeat }> = ({ beat }) => {
  const frame = useCurrentFrame();
  // Slow Ken Burns creep for the whole beat -- a still photo with zero motion reads as a slide,
  // not a clip. 1.0 -> 1.06 is subtle enough not to crop anything important off a portrait photo.
  const scale = interpolate(frame, [0, 30 * 6], [1, 1.06], { extrapolateRight: "clamp" });
  const captionIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: COLORS.ink, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Img
          src={beat.imageSrc}
          style={{
            width: "100%",
            height: "100%",
            objectFit: beat.fit ?? "cover",
          }}
        />
      </AbsoluteFill>

      {/* Scrim + caption, bottom-anchored so it reads the same regardless of photo content. */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(to bottom, transparent 60%, rgba(20,20,20,0.88) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 90,
          opacity: captionIn,
          transform: `translateY(${interpolate(captionIn, [0, 1], [16, 0])}px)`,
        }}
      >
        <div
          style={{
            font: `700 46px/1.3 ${FONTS.display}`,
            color: COLORS.paper,
            textShadow: "0 2px 20px rgba(0,0,0,0.6)",
          }}
        >
          {beat.caption}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const PhotoMontage: React.FC<PhotoMontageProps> = ({ beats, audioSrc }) => {
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      {audioSrc ? <Audio src={audioSrc} /> : null}
      <Series>
        {beats.map((beat, i) => (
          <Series.Sequence key={i} durationInFrames={Math.max(1, Math.round(beat.durationSeconds * 30))}>
            <Beat beat={beat} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

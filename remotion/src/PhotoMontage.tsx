import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Series, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "./theme";

// A vertical photo-montage clip: real photos (or a static Larry portrait for the two beats where
// he narrates directly) cut to a script, one <Series.Sequence> per beat so each beat's own
// duration comes straight from how long its slice of the narration actually took to say --
// nothing here is guessed or hand-timed.
//
// Everything is f(useCurrentFrame()), same rule as Clip.tsx: no Math.random, no Date.now, no CSS
// animation -- Remotion renders frames out of order, so anything else flickers between takes.

export interface MontageBeat {
  /** Full https URL -- a real photo in R2, or the Larry portrait for his two narrated beats. */
  imageSrc: string;
  /**
   * A real Larry-on-camera clip (ElevenLabs Flows/creatify-aurora), shown instead of imageSrc
   * when present. Always rendered muted -- the single master `audioSrc` track below is the only
   * audio for the whole piece, so the two tracks never fight or drift out of sync with each
   * other; the tradeoff is the clip's own lip-sync is timed to ITS OWN TTS pass, not the master
   * narration's, so it may be a touch off rather than frame-perfect. imageSrc still doubles as
   * this beat's poster/first-frame fallback if the video fails to decode.
   */
  videoSrc?: string;
  /** The line being spoken during this beat, burned in as a caption. */
  caption: string;
  /** How long this beat is on screen, in seconds -- derived from its slice of the narration. */
  durationSeconds: number;
  /** "contain" for Larry's portrait (never crop his face); "cover" (default) for real photos. */
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
      {beat.videoSrc ? (
        // No Ken Burns here -- the clip already has its own motion, and holds its last frame
        // for any remainder if this beat's window runs a touch longer than the clip itself.
        <AbsoluteFill>
          <OffthreadVideo
            src={beat.videoSrc}
            muted
            style={{ width: "100%", height: "100%", objectFit: beat.fit ?? "cover" }}
          />
        </AbsoluteFill>
      ) : (
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
      )}

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

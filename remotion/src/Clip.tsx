import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Audio, staticFile } from "remotion";
import { COLORS, FONTS } from "./theme";

// A vertical data clip.
//
// Everything here is f(useCurrentFrame()). No Math.random, no Date.now, no CSS animations, no
// GSAP -- Remotion renders frames in parallel and out of order, so anything that is not a pure
// function of the frame number produces a video that flickers between takes.
//
// The numbers are drawn as real text from real data, never generated imagery. That is the same
// rule already written into column-infographic.ts: an infographic's whole job is showing correct
// numbers, and a generative model cannot be trusted with a digit.

export interface BarItem {
  label: string;
  value: number;
  displayValue: string;
}

export interface ClipProps {
  eyebrow: string;
  hook: string;
  chartTitle: string;
  items: BarItem[];
  sourceNote?: string;
  cta: string;
  audioSrc?: string;
  /** 30 for a column, ~75 for an investigación. Read by calculateMetadata in Root. */
  durationSeconds?: number;
}

const PAD = 90;

function useFadeIn(startFrame: number, durationFrames = 12) {
  const frame = useCurrentFrame();
  return interpolate(frame - startFrame, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

const Bar: React.FC<{ item: BarItem; max: number; index: number; startFrame: number }> = ({
  item,
  max,
  index,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Staggered so the eye reads them in order instead of all at once.
  const delay = startFrame + index * 6;
  const grow = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 24 });
  const width = interpolate(grow, [0, 1], [0, (item.value / max) * 100]);
  const opacity = interpolate(frame - delay, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ marginBottom: 40, opacity }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ font: `500 38px/1.25 ${FONTS.body}`, color: COLORS.ink, maxWidth: "72%" }}>{item.label}</span>
        <span style={{ font: `700 44px/1 ${FONTS.mono}`, color: COLORS.rhino }}>{item.displayValue}</span>
      </div>
      <div style={{ height: 22, borderRadius: 999, background: COLORS.barTrack, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${width}%`, borderRadius: 999, background: COLORS.bar }} />
      </div>
    </div>
  );
};

export const Clip: React.FC<ClipProps> = ({ eyebrow, hook, chartTitle, items, sourceNote, cta, audioSrc }) => {
  const { durationInFrames, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const max = Math.max(...items.map((i) => i.value), 1);

  const hookOpacity = useFadeIn(0);
  const chartStart = Math.round(fps * 2.2);
  const ctaStart = durationInFrames - Math.round(fps * 2.6);
  const ctaOpacity = interpolate(frame - ctaStart, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    // Three bands stacked with space-between rather than absolute offsets. The first version
    // pinned the chart at a fixed top of 700px and the CTA to the bottom, which left two dead
    // gaps -- one under the hook and a bigger one under the source note. A flex column makes the
    // layout adapt to however many bars a piece actually has.
    <AbsoluteFill
      style={{
        background: COLORS.paper,
        padding: PAD,
        fontFamily: FONTS.body,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {audioSrc ? <Audio src={audioSrc} /> : null}

      <div style={{ opacity: hookOpacity }}>
        <div
          style={{
            font: `700 30px/1 ${FONTS.body}`,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: COLORS.rhino,
            marginBottom: 28,
          }}
        >
          {eyebrow}
        </div>
        <div style={{ font: `700 92px/1.1 ${FONTS.display}`, color: COLORS.ink, letterSpacing: -1 }}>{hook}</div>
      </div>

      {/* layout="none" is load-bearing. A Sequence wraps its children in an AbsoluteFill by
          default, so without it this block ignores the flex column and the page padding and
          lands on top of the hook in the corner -- which is exactly what happened the first
          time this was made non-absolute. */}
      <Sequence from={chartStart} layout="none">
        <div>
          <div style={{ font: `600 32px/1.35 ${FONTS.body}`, color: COLORS.soft, marginBottom: 40 }}>{chartTitle}</div>
          {items.map((item, i) => (
            <Bar key={item.label} item={item} max={max} index={i} startFrame={chartStart} />
          ))}
          {sourceNote ? (
            <div style={{ font: `400 24px/1.4 ${FONTS.body}`, color: COLORS.soft, marginTop: 18 }}>{sourceNote}</div>
          ) : null}
        </div>
      </Sequence>

      <div
        style={{
          opacity: ctaOpacity,
          borderTop: `2px solid ${COLORS.line}`,
          paddingTop: 30,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span style={{ font: `700 40px/1.2 ${FONTS.display}`, color: COLORS.ink }}>{cta}</span>
        <span style={{ font: `700 30px/1 ${FONTS.body}`, color: COLORS.rhino, letterSpacing: 1 }}>kilowatto.com</span>
      </div>
    </AbsoluteFill>
  );
};

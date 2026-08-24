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

// The site pairs a serif for headings with a sans for body. Remotion renders headless, so only
// fonts present in the container exist -- these stacks fall back cleanly rather than silently
// substituting something that reflows the layout.
export const FONTS = {
  display: "Georgia, 'Times New Roman', serif",
  body: "system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

-- One Gemini ("nano banana") editorial illustration per chart section, shown
-- alongside its data visualization -- separate from the chart's own SVG/CSS
-- rendering, which stays hand-coded (see docs/investigaciones-spec.md).
ALTER TABLE investigacion_charts ADD COLUMN image_r2_key TEXT;

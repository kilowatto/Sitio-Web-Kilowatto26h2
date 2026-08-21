// Cover/section imagery for "A fondo" pieces uses Gemini ("nano banana"), not
// Recraft like columns -- Esteban's explicit choice, see docs/investigaciones-spec.md.
// Reuses the same Gemini call + R2 storage columns already builds on for Larry's
// brand images, just under its own entry point.
import { generateWithGemini, storeImageBytes } from "./brand-image";

export async function generateInvestigacionImage(prompt: string): Promise<string | null> {
  const bytes = await generateWithGemini(prompt);
  if (!bytes) return null;
  return storeImageBytes(bytes, "image/png");
}

function defaultCoverPrompt(title: string, summary: string | null): string {
  return `Editorial illustration for a deep investigative tech/business piece titled "${title}". ${summary?.slice(0, 300) ?? ""} Conceptual metaphor, no text, no letters, no numbers, no logos, no recognizable people, clean professional editorial illustration style, warm amber and deep orange color palette, sense of investigation and uncovering hidden truth, cinematic lighting.`;
}

function defaultChartPrompt(title: string, description: string | null): string {
  return `Editorial illustration for a data journalism piece, illustrating: "${title}". ${description ?? ""} Conceptual metaphor, no text, no letters, no numbers, no logos, no recognizable people, clean professional editorial illustration style, warm amber and deep orange color palette, cinematic lighting.`;
}

// Backfills whatever imagery is missing -- a cover if the piece doesn't have one,
// and one illustration per chart that doesn't have one yet. Called automatically
// on approve/publish so a piece can never go live without images regardless of
// which path produced it (the 2026-08-21 test piece landed with zero images
// because the ad-hoc assembly process never called generate-cover/
// generate-chart-image at all -- Esteban: "siempre hay que tener imágenes dentro
// del sitio de a fondo con Kilowatto"). Also safe to call by hand any time; it
// only ever fills gaps, never regenerates an image that already exists.
export async function ensureInvestigacionImages(
  env: any,
  investigacionId: number
): Promise<{ coverGenerated: boolean; chartsGenerated: number }> {
  let coverGenerated = false;

  const row = await env.DB.prepare("SELECT title, summary, cover_r2_key FROM investigaciones WHERE id = ?")
    .bind(investigacionId)
    .first<any>();
  if (row && !row.cover_r2_key) {
    const r2Key = await generateInvestigacionImage(defaultCoverPrompt(row.title, row.summary));
    if (r2Key) {
      await env.DB.prepare("UPDATE investigaciones SET cover_r2_key = ? WHERE id = ?").bind(r2Key, investigacionId).run();
      coverGenerated = true;
    }
  }

  const chartsRes = await env.DB.prepare(
    "SELECT id, title, description FROM investigacion_charts WHERE investigacion_id = ? AND image_r2_key IS NULL"
  )
    .bind(investigacionId)
    .all<any>();

  let chartsGenerated = 0;
  for (const chart of chartsRes.results ?? []) {
    const r2Key = await generateInvestigacionImage(defaultChartPrompt(chart.title, chart.description));
    if (r2Key) {
      await env.DB.prepare("UPDATE investigacion_charts SET image_r2_key = ? WHERE id = ?").bind(r2Key, chart.id).run();
      chartsGenerated++;
    }
  }

  return { coverGenerated, chartsGenerated };
}

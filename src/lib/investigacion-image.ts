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

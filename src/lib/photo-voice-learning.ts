import { env } from "cloudflare:workers";

// Same RAG pattern as src/lib/brand-learning.ts (separate Vectorize index per learning
// domain, so photo-caption corrections never leak into Larry's brand-post feedback or bio
// retrieval) — every time Esteban polishes/rewrites an AI-drafted caption, the correction is
// embedded and stored, then future caption generation retrieves the most similar past
// corrections as few-shot style examples instead of a generic tone description.
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

async function embed(text: string): Promise<number[]> {
  const result: any = await env.AI.run(EMBEDDING_MODEL, { text: [text] });
  return result.data[0];
}

export async function recordCaptionCorrection(draft: string, corrected: string) {
  if (!draft.trim() || !corrected.trim() || draft.trim() === corrected.trim()) return;
  try {
    const values = await embed(draft);
    await env.PHOTO_VOICE.upsert([
      {
        id: `caption:${crypto.randomUUID()}`,
        values,
        metadata: { draft, corrected },
      },
    ]);
  } catch (err) {
    console.error("recordCaptionCorrection embedding failed:", err);
  }
}

export async function retrieveVoiceExamples(draftCaption: string): Promise<string> {
  try {
    const queryVector = await embed(draftCaption);
    const matches = await env.PHOTO_VOICE.query(queryVector, { topK: 3, returnMetadata: true });
    const relevant = (matches?.matches ?? []).filter((m: any) => m.score > 0.4);
    if (relevant.length === 0) return "";

    const block = relevant
      .map((m: any) => `- Antes: "${m.metadata.draft}" → Esteban lo reescribió así: "${m.metadata.corrected}"`)
      .join("\n");

    return `Ejemplos reales de cómo Esteban corrige descripciones parecidas — imita ese registro:\n${block}`;
  } catch (err) {
    console.error("retrieveVoiceExamples failed:", err);
    return "";
  }
}

import { env } from "cloudflare:workers";

// Real RAG for the learning loop — same embedding model as Larry's chatbot (bge-base-en-v1.5,
// 768-dim), but a SEPARATE Vectorize index (kilowatto-brand-feedback) so brand-feedback
// vectors never contaminate Larry's bio retrieval. Previously this was a plain SQL "last 8
// rows" dump with no relevance ranking — every generation got the same feedback regardless
// of topic. Now each rejection/edit is embedded once and retrieved by semantic similarity
// to the CURRENT topic, so a correction about "curling" posts doesn't leak into a
// "cloud computing" generation.
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

async function embed(text: string): Promise<number[]> {
  const result: any = await env.AI.run(EMBEDDING_MODEL, { text: [text] });
  return result.data[0];
}

export async function recordFeedback(params: {
  type: "rejection" | "edit" | "low_performance";
  text: string;
  topicId?: number | null;
  platform: string;
}) {
  try {
    const values = await embed(params.text);
    await env.BRAND_FEEDBACK.upsert([
      {
        id: `feedback:${crypto.randomUUID()}`,
        values,
        metadata: {
          type: params.type,
          topicId: params.topicId ?? 0,
          platform: params.platform,
          text: params.text,
        },
      },
    ]);
  } catch (err) {
    console.error("recordFeedback embedding failed:", err);
  }
}

export async function retrieveLearningContext(topicLabel: string, topicDescription: string): Promise<string> {
  try {
    const queryVector = await embed(`${topicLabel} — ${topicDescription}`);
    const matches = await env.BRAND_FEEDBACK.query(queryVector, { topK: 5, returnMetadata: true });
    const relevant = (matches?.matches ?? []).filter((m: any) => m.score > 0.5);
    if (relevant.length === 0) return "";

    const TYPE_LABELS: Record<string, string> = {
      rejection: "rechazado",
      edit: "editado",
      low_performance: "bajo rendimiento real",
    };
    const block = relevant
      .map((m: any) => `- (${TYPE_LABELS[m.metadata.type] ?? m.metadata.type}) ${m.metadata.text}`)
      .join("\n");

    return `Aprende de esto — correcciones y rechazos reales de Esteban MÁS RELEVANTES para este tema específico, para no repetir los mismos errores:\n${block}`;
  } catch (err) {
    console.error("retrieveLearningContext failed:", err);
    return "";
  }
}

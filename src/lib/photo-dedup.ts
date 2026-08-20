import { env } from "cloudflare:workers";

const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
// Near-duplicate threshold — burst shots of the same pose/scene produce almost identical
// literal descriptions from the vision model; two genuinely different photos (even of a
// similar subject) score meaningfully lower. Confirmed by design, not yet tuned against a
// large real-world batch — worth revisiting if it ever misses an obvious duplicate.
const NEAR_DUPLICATE_THRESHOLD = 0.96;
const NEAR_DUPLICATE_DATE_WINDOW_DAYS = 2;

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function embed(text: string): Promise<number[]> {
  const result: any = await env.AI.run(EMBEDDING_MODEL, { text: [text] });
  return result.data[0];
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const diff = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return diff / (1000 * 60 * 60 * 24);
}

// Checked BEFORE storing a new photo. Two layers: exact (SHA-256 of the raw bytes — catches
// re-uploading the literal same file) and near-duplicate (embeds the vision model's literal
// scene description in a dedicated Vectorize index, separate from voice-learning/bio-facts —
// catches burst shots that are byte-different but visually/contextually the same moment).
export async function findDuplicate(
  bytes: Uint8Array,
  album: string,
  takenDate: string | null,
  sceneDescription: string
): Promise<{ duplicateOf: number } | null> {
  const fileHash = await hashBytes(bytes);
  const exact = await env.DB.prepare("SELECT id FROM photos WHERE file_hash = ?").bind(fileHash).first<any>();
  if (exact) return { duplicateOf: exact.id };

  if (!sceneDescription.trim()) return null;
  try {
    const queryVector = await embed(sceneDescription);
    const matches = await env.PHOTO_DEDUP.query(queryVector, { topK: 3, returnMetadata: true });
    for (const m of matches?.matches ?? []) {
      if (m.score < NEAR_DUPLICATE_THRESHOLD) continue;
      if (m.metadata?.album !== album) continue;
      const gap = daysBetween(takenDate, m.metadata?.takenDate ?? null);
      if (gap !== null && gap > NEAR_DUPLICATE_DATE_WINDOW_DAYS) continue;
      return { duplicateOf: m.metadata.photoId };
    }
  } catch (err) {
    console.error("findDuplicate near-duplicate check failed:", err);
  }
  return null;
}

export async function registerForDedup(
  photoId: number,
  album: string,
  takenDate: string | null,
  sceneDescription: string
) {
  if (!sceneDescription.trim()) return;
  try {
    const values = await embed(sceneDescription);
    await env.PHOTO_DEDUP.upsert([
      {
        id: `photo:${photoId}`,
        values,
        metadata: { photoId, album, takenDate: takenDate ?? "" },
      },
    ]);
  } catch (err) {
    console.error("registerForDedup embedding failed:", err);
  }
}

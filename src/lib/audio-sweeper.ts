import { env } from "cloudflare:workers";
import { runNarrate } from "./narrate";
import { runNarrateDialogue } from "./narrate-dialogue";
import { runAudioPost } from "./audio-post";
import { sendAlert } from "./alerts";

// Generates whatever audio is missing, a little at a time, on a schedule.
//
// Every one of the 46 narrations and 6 conversations was produced by someone running a command
// by hand. Neither approve.ts hooks any of it, so a piece published tomorrow would simply have
// no audio and nothing would say so.
//
// A sweep rather than a hook in approve.ts, for three reasons:
//   - Generating a piece takes minutes. Approving an article should not wait on it.
//   - The English audio cannot start until the English translation exists, and that translation
//     is itself a background workflow fired by the same approve. A hook would race it; a sweep
//     just finds the work later, when it is ready.
//   - A sweep is self-healing. A failed run is retried on the next pass instead of needing
//     someone to notice.
//
// The cost of that choice is that audio appears hours after publication rather than minutes.
// That is the right trade for a site that publishes a few pieces a month.

const LOCALES = ["es-MX", "en"] as const;

// Per-run cap. The sweep runs every six hours, so this bounds the worst case at 8 assets a day
// -- about $6 -- which matters because a bug that queues work in a loop would otherwise bill
// against Esteban's account until someone looked.
const DEFAULT_LIMIT = 2;

// A piece that fails deterministically (bad translation, missing body) would otherwise be
// retried every sweep forever, burning the whole per-run budget and starving everything behind
// it. One retry a day is enough to recover from a transient failure without that.
const FAILED_COOLDOWN_HOURS = 24;

const KILL_SWITCH_KEY = "audio_sweep_enabled";
const LAST_RUN_KEY = "audio_sweep_last_run";

export interface PendingAudio {
  entityType: "columna" | "investigacion";
  entityId: number;
  locale: string;
  kind: "audio_narration" | "audio_dialogue";
  title: string;
}

interface AssetRow {
  entity_type: string;
  entity_id: number;
  locale: string;
  kind: string;
  status: string;
  updated_at: string;
}

export async function findPendingAudio(): Promise<PendingAudio[]> {
  const [columns, investigaciones, assets, translated] = await Promise.all([
    env.DB.prepare(`SELECT id, title FROM columns WHERE status = 'published'`).all<{ id: number; title: string }>(),
    env.DB.prepare(`SELECT id, title FROM investigaciones WHERE status = 'published'`).all<{ id: number; title: string }>(),
    env.DB.prepare(
      `SELECT entity_type, entity_id, locale, kind, status, updated_at FROM media_assets`
    ).all<AssetRow>(),
    // Only body_html matters: buildAudioScript throws without it, and narrating a piece whose
    // translation has not landed yet would read Spanish in an English voice -- a failure you
    // only discover by listening to finished audio.
    env.DB.prepare(
      `SELECT entity_type, entity_id, locale FROM translations WHERE field_key = 'body_html'`
    ).all<{ entity_type: string; entity_id: number; locale: string }>(),
  ]);

  const have = new Map<string, AssetRow>();
  for (const a of assets.results ?? []) {
    have.set(`${a.entity_type}:${a.entity_id}:${a.locale}:${a.kind}`, a);
  }
  const hasTranslation = new Set(
    (translated.results ?? []).map((t) => `${t.entity_type}:${t.entity_id}:${t.locale}`)
  );

  const blocked = (key: string): boolean => {
    const row = have.get(key);
    if (!row) return false;
    if (row.status === "ready" || row.status === "generating") return true;
    if (row.status === "failed") {
      const age = Date.now() - new Date(row.updated_at.replace(" ", "T") + "Z").getTime();
      return age < FAILED_COOLDOWN_HOURS * 3600 * 1000;
    }
    return false;
  };

  const pending: PendingAudio[] = [];
  const consider = (
    entityType: PendingAudio["entityType"],
    entityId: number,
    title: string,
    locale: string,
    kind: PendingAudio["kind"]
  ) => {
    if (blocked(`${entityType}:${entityId}:${locale}:${kind}`)) return;
    if (locale !== "es-MX") {
      const table = entityType === "columna" ? "columns" : "investigaciones";
      if (!hasTranslation.has(`${table}:${entityId}:${locale}`)) return;
    }
    pending.push({ entityType, entityId, locale, kind, title });
  };

  // Order is priority order. Spanish before English, and for an investigación the conversation
  // before the full reading -- the conversation is the one people actually finish, so if only
  // one thing gets made this pass it should be that.
  for (const locale of LOCALES) {
    for (const i of investigaciones.results ?? []) {
      consider("investigacion", i.id, i.title, locale, "audio_dialogue");
    }
    for (const c of columns.results ?? []) {
      consider("columna", c.id, c.title, locale, "audio_narration");
    }
    for (const i of investigaciones.results ?? []) {
      consider("investigacion", i.id, i.title, locale, "audio_narration");
    }
  }
  return pending;
}

export interface SweepResult {
  enabled: boolean;
  pending: number;
  attempted: PendingAudio[];
  results: { item: PendingAudio; ok: boolean; detail: string }[];
}

export async function runAudioSweep(limit = DEFAULT_LIMIT): Promise<SweepResult> {
  const enabled = (await env.KILOWATTO_KV.get(KILL_SWITCH_KEY)) !== "0";
  const pending = await findPendingAudio();
  if (!enabled) return { enabled, pending: pending.length, attempted: [], results: [] };

  const attempted = pending.slice(0, Math.max(0, limit));
  const results: SweepResult["results"] = [];

  for (const item of attempted) {
    try {
      if (item.kind === "audio_dialogue") {
        const r = await runNarrateDialogue(item.entityId, item.locale);
        results.push({
          item,
          ok: !!r.ok,
          detail: r.ok ? (r.skipped ?? `${r.beats} hallazgos, ${r.durationS}s`) : String(r.error),
        });
      } else {
        const r = await runNarrate(item.entityType, item.entityId, item.locale);
        results.push({
          item,
          ok: !!r.ok,
          detail: r.ok ? (r.skipped ?? `${r.durationS}s`) : String(r.error),
        });
      }
    } catch (err: any) {
      results.push({ item, ok: false, detail: String(err?.message ?? err) });
    }

    // A finished asset should announce itself. Best-effort and idempotent: a failure here must
    // never mark the generation itself as failed, and the sweep re-runs every six hours.
    const last = results[results.length - 1];
    if (last?.ok && item.locale === "es-MX") {
      const posted = await runAudioPost(item.entityType, item.entityId, item.kind);
      if (posted.created) last.detail += ` · ${posted.created} posts en cola`;
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    await sendAlert(
      `Audio: ${failed.length} pieza${failed.length === 1 ? "" : "s"} falló al generarse`,
      failed.map((f) => `${f.item.kind} · ${f.item.entityType} ${f.item.entityId} (${f.item.locale})\n  ${f.detail}`).join("\n\n")
    );
  }

  await env.KILOWATTO_KV.put(
    LAST_RUN_KEY,
    JSON.stringify({ at: new Date().toISOString(), pending: pending.length, done: results.length })
  );

  return { enabled, pending: pending.length, attempted, results };
}

export async function lastSweep(): Promise<{ at: string; pending: number; done: number } | null> {
  try {
    const raw = await env.KILOWATTO_KV.get(LAST_RUN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

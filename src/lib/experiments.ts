import { env } from "cloudflare:workers";
import { getDownloadsByEpisode } from "./podcast-downloads";

// The measurement side of the pipeline: which knob setting a piece was made with, and what
// happened to it afterwards.
//
// Two design choices are load-bearing.
//
// Assignment is BALANCED, not random. Five posts a week is a small enough sample that a fair
// coin lands 4-1 often enough to matter, and a run of one arm would waste weeks. Each new
// subject goes to whichever arm has the fewest assignments so far, ties broken by name so the
// result is reproducible -- and reproducible matters here beyond taste, since the clip renderer
// is Remotion and Math.random() is banned in that whole workspace anyway.
//
// A winner needs BOTH thresholds. Esteban asked for "un sistema con umbral" rather than picking
// whatever number is bigger, and with five posts a week the bigger number is usually noise: the
// leader must have min_sample subjects in every arm AND beat the runner-up by min_lift. Until
// then the honest answer is "todavía no se sabe", and that is what this returns.

export interface Arm {
  arm: string;
  config: Record<string, unknown>;
}

export interface ArmResult {
  arm: string;
  config: Record<string, unknown>;
  subjects: number;
  /** Clicks for a post or clip, downloads for an episode. */
  outcome: number;
  perSubject: number;
}

export interface ExperimentReport {
  key: string;
  surface: "post" | "clip" | "audio";
  description: string | null;
  status: string;
  minSample: number;
  minLift: number;
  arms: ArmResult[];
  leader: string | null;
  /** Null while the thresholds are unmet -- which is most of the time, by design. */
  winner: string | null;
  /** Why there is no winner yet, in words, for the dashboard. */
  verdict: string;
}

interface ExperimentRow {
  id: number;
  key: string;
  surface: "post" | "clip" | "audio";
  description: string | null;
  min_sample: number;
  min_lift: number;
  status: string;
  winner: string | null;
}

async function loadExperiment(key: string): Promise<ExperimentRow | null> {
  return env.DB.prepare(
    `SELECT id, key, surface, description, min_sample, min_lift, status, winner FROM experiments WHERE key = ?`
  )
    .bind(key)
    .first<ExperimentRow>();
}

async function loadArms(experimentId: number): Promise<Arm[]> {
  const rows = await env.DB.prepare(
    `SELECT arm, config_json FROM experiment_arms WHERE experiment_id = ? ORDER BY arm ASC`
  )
    .bind(experimentId)
    .all<{ arm: string; config_json: string | null }>();
  return (rows.results ?? []).map((r) => {
    let config: Record<string, unknown> = {};
    try {
      config = r.config_json ? JSON.parse(r.config_json) : {};
    } catch {
      /* a malformed config must not take the pipeline down; the arm still exists */
    }
    return { arm: r.arm, config };
  });
}

// Returns the arm a new subject should get, WITHOUT recording anything -- the caller may still
// fail before there is a subject id to record against. Once the subject exists, call assign().
export async function pickArm(key: string): Promise<Arm | null> {
  const exp = await loadExperiment(key);
  if (!exp || exp.status !== "running") return null;
  const arms = await loadArms(exp.id);
  if (arms.length === 0) return null;

  // A decided experiment keeps serving its winner rather than continuing to spend half the
  // budget on the losing arm.
  if (exp.winner) return arms.find((a) => a.arm === exp.winner) ?? arms[0];

  const counts = await env.DB.prepare(
    `SELECT arm, COUNT(*) AS n FROM experiment_assignments WHERE experiment_id = ? GROUP BY arm`
  )
    .bind(exp.id)
    .all<{ arm: string; n: number }>();
  const byArm = new Map((counts.results ?? []).map((r) => [r.arm, r.n]));

  return arms.reduce((best, a) =>
    (byArm.get(a.arm) ?? 0) < (byArm.get(best.arm) ?? 0) ? a : best
  );
}

export async function assign(
  key: string,
  arm: string,
  subjectType: "brand_post" | "media_asset",
  subjectId: number
): Promise<void> {
  const exp = await loadExperiment(key);
  if (!exp) return;
  // OR IGNORE, not a check-then-insert: two sweeps overlapping would otherwise both see "not
  // assigned" and the UNIQUE constraint would turn a duplicate into a thrown error inside a
  // pipeline that has already spent money on a render.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO experiment_assignments (experiment_id, arm, subject_type, subject_id)
     VALUES (?, ?, ?, ?)`
  )
    .bind(exp.id, arm, subjectType, subjectId)
    .run();
}

// Clicks per post, from the short-link log. brand_post_metrics also has impressions, which would
// make this a CTR -- but impressions only exist for X and only for posts old enough to have been
// measured, so a CTR would silently compare an arm that has them against one that does not.
// Clicks are recorded for every platform on every post.
async function postOutcomes(experimentId: number): Promise<Map<string, { subjects: number; outcome: number }>> {
  const rows = await env.DB.prepare(
    `SELECT a.arm,
            COUNT(DISTINCT a.subject_id) AS subjects,
            COALESCE(SUM(l.clicks), 0) AS outcome
       FROM experiment_assignments a
       LEFT JOIN (
         SELECT brand_post_id, COUNT(*) AS clicks
           FROM link_clicks lc JOIN short_links s ON s.id = lc.short_link_id
          WHERE s.brand_post_id IS NOT NULL
          GROUP BY brand_post_id
       ) l ON l.brand_post_id = a.subject_id
       JOIN brand_posts p ON p.id = a.subject_id
      WHERE a.experiment_id = ? AND a.subject_type = 'brand_post'
        -- Only posts that actually went out. A pending or rejected draft has no outcome and
        -- counting it as a zero would punish whichever arm happens to have more of them.
        AND p.status = 'posted'
      GROUP BY a.arm`
  )
    .bind(experimentId)
    .all<{ arm: string; subjects: number; outcome: number }>();
  return new Map((rows.results ?? []).map((r) => [r.arm, { subjects: r.subjects, outcome: r.outcome }]));
}

// Downloads per episode. These live in Analytics Engine, not D1, so this is a join done in
// memory against media_assets rather than in SQL.
async function audioOutcomes(experimentId: number): Promise<Map<string, { subjects: number; outcome: number }>> {
  const assigned = await env.DB.prepare(
    `SELECT a.arm, m.entity_type, m.entity_id, m.kind, m.locale
       FROM experiment_assignments a
       JOIN media_assets m ON m.id = a.subject_id
      WHERE a.experiment_id = ? AND a.subject_type = 'media_asset' AND m.status = 'ready'`
  )
    .bind(experimentId)
    .all<{ arm: string; entity_type: string; entity_id: number; kind: string; locale: string }>();

  const downloads = await getDownloadsByEpisode(90, 500);
  const byEpisode = new Map(
    (downloads ?? []).map((d) => [`${d.entityType}:${d.entityId}:${d.kind}:${d.locale}`, d.downloads])
  );

  const out = new Map<string, { subjects: number; outcome: number }>();
  for (const row of assigned.results ?? []) {
    const cur = out.get(row.arm) ?? { subjects: 0, outcome: 0 };
    cur.subjects += 1;
    cur.outcome += byEpisode.get(`${row.entity_type}:${row.entity_id}:${row.kind}:${row.locale}`) ?? 0;
    out.set(row.arm, cur);
  }
  return out;
}

export async function report(key: string): Promise<ExperimentReport | null> {
  const exp = await loadExperiment(key);
  if (!exp) return null;
  const armDefs = await loadArms(exp.id);
  const outcomes =
    exp.surface === "audio" ? await audioOutcomes(exp.id) : await postOutcomes(exp.id);

  const arms: ArmResult[] = armDefs.map((a) => {
    const o = outcomes.get(a.arm) ?? { subjects: 0, outcome: 0 };
    return {
      arm: a.arm,
      config: a.config,
      subjects: o.subjects,
      outcome: o.outcome,
      perSubject: o.subjects > 0 ? o.outcome / o.subjects : 0,
    };
  });

  const ranked = [...arms].sort((a, b) => b.perSubject - a.perSubject);
  const leader = ranked[0]?.subjects > 0 ? ranked[0].arm : null;
  const runnerUp = ranked[1];

  let winner: string | null = exp.winner;
  let verdict: string;
  const thin = arms.filter((a) => a.subjects < exp.min_sample);

  if (exp.winner) {
    verdict = `decidido: ${exp.winner}`;
  } else if (thin.length > 0) {
    verdict = `faltan piezas: ${thin
      .map((a) => `${a.arm} ${a.subjects}/${exp.min_sample}`)
      .join(", ")}`;
  } else if (!runnerUp || runnerUp.perSubject <= 0) {
    // Everything else is at zero. A leader with any result at all wins by definition here, but
    // "infinitely better than nothing" is not a measurement.
    verdict = ranked[0].perSubject > 0
      ? `${ranked[0].arm} es el único con resultado; falta que el otro brazo mida algo`
      : "sin resultados todavía en ningún brazo";
  } else {
    const lift = (ranked[0].perSubject - runnerUp.perSubject) / runnerUp.perSubject;
    if (lift >= exp.min_lift) {
      winner = ranked[0].arm;
      verdict = `${winner} gana por ${Math.round(lift * 100)}% (umbral ${Math.round(exp.min_lift * 100)}%)`;
    } else {
      verdict = `${ranked[0].arm} va arriba por ${Math.round(lift * 100)}%, debajo del umbral de ${Math.round(
        exp.min_lift * 100
      )}%`;
    }
  }

  return {
    key: exp.key,
    surface: exp.surface,
    description: exp.description,
    status: exp.status,
    minSample: exp.min_sample,
    minLift: exp.min_lift,
    arms,
    leader,
    winner,
    verdict,
  };
}

export async function allReports(): Promise<ExperimentReport[]> {
  const rows = await env.DB.prepare(`SELECT key FROM experiments ORDER BY surface, key`).all<{ key: string }>();
  const out: ExperimentReport[] = [];
  for (const r of rows.results ?? []) {
    const rep = await report(r.key);
    if (rep) out.push(rep);
  }
  return out;
}

// Writes a winner down. Separate from report() on purpose: reading the numbers must never have a
// side effect, and a dashboard that decided experiments just by being opened would be a trap.
export async function decide(key: string): Promise<ExperimentReport | null> {
  const rep = await report(key);
  if (!rep || !rep.winner || rep.status === "decided") return rep;
  await env.DB.prepare(
    `UPDATE experiments SET winner = ?, status = 'decided', decided_at = datetime('now') WHERE key = ?`
  )
    .bind(rep.winner, key)
    .run();
  return { ...rep, status: "decided", verdict: `decidido: ${rep.winner}` };
}

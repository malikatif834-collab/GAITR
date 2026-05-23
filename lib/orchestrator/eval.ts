import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  agentRuns,
  alchemyScenarios,
  attackFingerprints,
  evalResults,
  incidentToolLinks,
  incidents,
  saifMappings,
} from "@/lib/db/schema";

/**
 * Per-tick eval writer (ADR 0005 D8). Three deterministic SQL aggregates
 * over the trailing 24h, one eval_results row each:
 *
 *   extract.fingerprint_coverage    — incidents-with-fingerprint / incidents
 *   correlate.capability_link_yield — mean links per correlate run
 *   map.controls_per_scenario       — mean mappings per scenario
 *
 * Two G2 metrics (synthesize.reviewer_override_rate, map.expert_agreement)
 * are deferred — they need Phase 4 reviewer data + a Phase 5 holdout set.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;

export const EVAL_METRICS = [
  "extract.fingerprint_coverage",
  "correlate.capability_link_yield",
  "map.controls_per_scenario",
] as const;
export type EvalMetric = (typeof EVAL_METRICS)[number];

export interface EvalRow {
  metric: EvalMetric;
  stageId: "extract" | "correlate" | "map";
  value: number;
  sampleSize: number;
}

export async function computeMetrics(now: Date): Promise<EvalRow[]> {
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  const [coverage, yield_, controls] = await Promise.all([
    computeFingerprintCoverage(windowStart, now),
    computeCapabilityLinkYield(windowStart, now),
    computeControlsPerScenario(windowStart, now),
  ]);

  const rows: EvalRow[] = [coverage, yield_, controls];

  if (rows.length > 0) {
    await db.insert(evalResults).values(
      rows.map((r) => ({
        stageId: r.stageId,
        metric: r.metric,
        value: r.value.toFixed(4),
        sampleSize: r.sampleSize,
        windowStart,
        windowEnd: now,
      })),
    );
  }

  return rows;
}

async function computeFingerprintCoverage(
  windowStart: Date,
  windowEnd: Date,
): Promise<EvalRow> {
  // Coverage across ALL incidents (not just window-created) — the metric
  // is "do we have a fingerprint for what we've seen", and incidents
  // are persistent. Sample size is the incident count.
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(incidents);

  const [{ withFp }] = await db
    .select({
      withFp: sql<number>`count(distinct ${attackFingerprints.incidentId})::int`,
    })
    .from(attackFingerprints);

  const value = total === 0 ? 0 : withFp / total;
  void windowStart;
  void windowEnd;
  return {
    metric: "extract.fingerprint_coverage",
    stageId: "extract",
    value,
    sampleSize: total,
  };
}

async function computeCapabilityLinkYield(
  windowStart: Date,
  windowEnd: Date,
): Promise<EvalRow> {
  // Mean capability links created in window per correlate run in window.
  // Window-scoped — measures recent productivity, not cumulative drift.
  const [{ runs }] = await db
    .select({ runs: sql<number>`count(*)::int` })
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.stageId, "correlate"),
        eq(agentRuns.status, "succeeded"),
        gte(agentRuns.completedAt, windowStart),
        lte(agentRuns.completedAt, windowEnd),
      ),
    );

  const [{ links }] = await db
    .select({ links: sql<number>`count(*)::int` })
    .from(incidentToolLinks)
    .where(
      and(
        eq(incidentToolLinks.matchType, "capability"),
        gte(incidentToolLinks.createdAt, windowStart),
        lte(incidentToolLinks.createdAt, windowEnd),
      ),
    );

  const value = runs === 0 ? 0 : links / runs;
  return {
    metric: "correlate.capability_link_yield",
    stageId: "correlate",
    value,
    sampleSize: runs,
  };
}

async function computeControlsPerScenario(
  windowStart: Date,
  windowEnd: Date,
): Promise<EvalRow> {
  // Mean mappings per scenario over the window. Numerator and
  // denominator are both window-scoped via saif_mappings.created_at —
  // catches "map produces 0 mappings" silently and tracks the live
  // mapping yield rather than cumulative drift.
  const perScenario = await db
    .select({
      subjectId: saifMappings.subjectId,
      n: sql<number>`count(*)::int`,
    })
    .from(saifMappings)
    .where(
      and(
        eq(saifMappings.subjectKind, "scenario"),
        gte(saifMappings.createdAt, windowStart),
        lte(saifMappings.createdAt, windowEnd),
      ),
    )
    .groupBy(saifMappings.subjectId);

  if (perScenario.length === 0) {
    // Fall back to the all-time mean so the scorecard never reads NaN
    // on a fresh deploy / quiet window. Sample size still reflects 0
    // so the panel can flag the gap.
    const [{ totalMappings }] = await db
      .select({ totalMappings: sql<number>`count(*)::int` })
      .from(saifMappings)
      .where(eq(saifMappings.subjectKind, "scenario"));
    const [{ totalScenarios }] = await db
      .select({ totalScenarios: sql<number>`count(*)::int` })
      .from(alchemyScenarios);
    return {
      metric: "map.controls_per_scenario",
      stageId: "map",
      value: totalScenarios === 0 ? 0 : totalMappings / totalScenarios,
      sampleSize: 0,
    };
  }

  const totalInWindow = perScenario.reduce((acc, r) => acc + r.n, 0);
  return {
    metric: "map.controls_per_scenario",
    stageId: "map",
    value: totalInWindow / perScenario.length,
    sampleSize: perScenario.length,
  };
}

import type { OrchestratorState, PlannedAction } from "./types";

/** Planner config — small enough to stay constants here; if it ever
 *  grows past one-screen, lift to a passed-in policy object. */
export const PLANNER_RULE_VERSION = 1;
export const PLANNER_ACTION_CAP = 20;
export const INGEST_STALE_MS = 60 * 60 * 1000; // 1h

/**
 * Pure planner. Given a state snapshot and "now", emit an ordered list
 * of actions (capped). No DB access — fully unit-testable.
 *
 * Rules (ADR 0005 D1, in priority order):
 *   1. Source enabled AND (lastIngestAt null OR > INGEST_STALE_MS old) → ingest.
 *   2. Incident without a fingerprint → extract.
 *   3. Incident with fingerprint but no correlate run → correlate.
 *   4. Scenario without a map run → map.
 *   5. Scenario with map but no report → report.
 *
 * `synthesize` is intentionally NOT planner-dispatched in v1 — it stays
 * operator-initiated (the largest prompt-injection surface; one human
 * leash).
 */
export function buildPlan(
  state: OrchestratorState,
  now: Date,
  cap: number = PLANNER_ACTION_CAP,
): { actions: PlannedAction[]; truncated: boolean } {
  const out: PlannedAction[] = [];

  for (const s of state.sources) {
    if (!s.enabled) continue;
    const stale =
      s.lastIngestAt === null ||
      now.getTime() - s.lastIngestAt.getTime() > INGEST_STALE_MS;
    if (stale) {
      out.push({
        kind: "ingest",
        sourceId: s.id,
        rule: "ingest-stale-source",
      });
    }
  }

  for (const inc of state.incidents) {
    if (!inc.hasFingerprint) {
      out.push({
        kind: "extract",
        incidentId: inc.id,
        rule: "extract-missing-fingerprint",
      });
    }
  }

  for (const inc of state.incidents) {
    if (inc.hasFingerprint && !inc.hasCorrelateRun) {
      out.push({
        kind: "correlate",
        incidentId: inc.id,
        rule: "correlate-missing-run",
      });
    }
  }

  for (const sc of state.scenarios) {
    if (!sc.hasMapRun) {
      out.push({
        kind: "map",
        subject: { kind: "scenario", id: sc.id },
        rule: "map-missing-run",
      });
    }
  }

  for (const sc of state.scenarios) {
    if (sc.hasMapRun && !sc.hasReportRun) {
      out.push({
        kind: "report",
        subject: { kind: "scenario", id: sc.id },
        rule: "report-missing-run",
      });
    }
  }

  const truncated = out.length > cap;
  return { actions: truncated ? out.slice(0, cap) : out, truncated };
}

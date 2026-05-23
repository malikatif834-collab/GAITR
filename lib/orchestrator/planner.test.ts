import { describe, expect, it } from "vitest";
import {
  buildPlan,
  INGEST_STALE_MS,
  PLANNER_ACTION_CAP,
} from "./planner";
import type { OrchestratorState } from "./types";

const NOW = new Date("2026-05-23T19:00:00Z");

function empty(): OrchestratorState {
  return { sources: [], incidents: [], scenarios: [] };
}

describe("orchestrator/planner — rule 1: ingest stale sources", () => {
  it("plans ingest for an enabled source that has never run", () => {
    const state: OrchestratorState = {
      ...empty(),
      sources: [{ id: "s1", enabled: true, lastIngestAt: null }],
    };
    const { actions } = buildPlan(state, NOW);
    expect(actions).toEqual([
      { kind: "ingest", sourceId: "s1", rule: "ingest-stale-source" },
    ]);
  });

  it("plans ingest for an enabled source whose last run is past the staleness window", () => {
    const state: OrchestratorState = {
      ...empty(),
      sources: [
        {
          id: "s2",
          enabled: true,
          lastIngestAt: new Date(NOW.getTime() - INGEST_STALE_MS - 1),
        },
      ],
    };
    expect(buildPlan(state, NOW).actions).toHaveLength(1);
  });

  it("skips disabled sources and fresh sources", () => {
    const state: OrchestratorState = {
      ...empty(),
      sources: [
        { id: "disabled", enabled: false, lastIngestAt: null },
        {
          id: "fresh",
          enabled: true,
          lastIngestAt: new Date(NOW.getTime() - 60_000),
        },
      ],
    };
    expect(buildPlan(state, NOW).actions).toEqual([]);
  });
});

describe("orchestrator/planner — rule 2: extract missing fingerprint", () => {
  it("plans extract only for incidents without a fingerprint", () => {
    const state: OrchestratorState = {
      ...empty(),
      incidents: [
        { id: "i1", hasFingerprint: false, hasCorrelateRun: false },
        { id: "i2", hasFingerprint: true, hasCorrelateRun: true },
      ],
    };
    const { actions } = buildPlan(state, NOW);
    expect(actions).toEqual([
      {
        kind: "extract",
        incidentId: "i1",
        rule: "extract-missing-fingerprint",
      },
    ]);
  });
});

describe("orchestrator/planner — rule 3: correlate missing run", () => {
  it("plans correlate only when fingerprint exists and correlate hasn't run", () => {
    const state: OrchestratorState = {
      ...empty(),
      incidents: [
        { id: "needs", hasFingerprint: true, hasCorrelateRun: false },
        { id: "done", hasFingerprint: true, hasCorrelateRun: true },
        { id: "no-fp", hasFingerprint: false, hasCorrelateRun: false },
      ],
    };
    const { actions } = buildPlan(state, NOW);
    expect(actions).toContainEqual({
      kind: "correlate",
      incidentId: "needs",
      rule: "correlate-missing-run",
    });
    expect(
      actions.filter((a) => a.kind === "correlate" && a.incidentId === "done"),
    ).toHaveLength(0);
    expect(
      actions.filter((a) => a.kind === "correlate" && a.incidentId === "no-fp"),
    ).toHaveLength(0);
  });
});

describe("orchestrator/planner — rules 4 + 5: map then report", () => {
  it("plans map and report in the right precedence per scenario", () => {
    const state: OrchestratorState = {
      ...empty(),
      scenarios: [
        { id: "needs-map", hasMapRun: false, hasReportRun: false },
        { id: "needs-report", hasMapRun: true, hasReportRun: false },
        { id: "done", hasMapRun: true, hasReportRun: true },
      ],
    };
    const { actions } = buildPlan(state, NOW);
    expect(actions).toContainEqual({
      kind: "map",
      subject: { kind: "scenario", id: "needs-map" },
      rule: "map-missing-run",
    });
    expect(actions).toContainEqual({
      kind: "report",
      subject: { kind: "scenario", id: "needs-report" },
      rule: "report-missing-run",
    });
    // 'done' produces nothing
    expect(actions.filter((a) => "subject" in a && a.subject.id === "done"))
      .toHaveLength(0);
  });
});

describe("orchestrator/planner — cap", () => {
  it("truncates to PLANNER_ACTION_CAP and reports truncated=true", () => {
    const state: OrchestratorState = {
      ...empty(),
      incidents: Array.from({ length: PLANNER_ACTION_CAP + 5 }, (_, i) => ({
        id: `i${i}`,
        hasFingerprint: false,
        hasCorrelateRun: false,
      })),
    };
    const { actions, truncated } = buildPlan(state, NOW);
    expect(actions).toHaveLength(PLANNER_ACTION_CAP);
    expect(truncated).toBe(true);
  });

  it("does not truncate when under cap", () => {
    const state: OrchestratorState = {
      ...empty(),
      incidents: [
        { id: "x", hasFingerprint: false, hasCorrelateRun: false },
      ],
    };
    const { actions, truncated } = buildPlan(state, NOW);
    expect(actions).toHaveLength(1);
    expect(truncated).toBe(false);
  });
});

describe("orchestrator/planner — empty state", () => {
  it("returns no actions when nothing needs doing", () => {
    expect(buildPlan(empty(), NOW).actions).toEqual([]);
  });
});

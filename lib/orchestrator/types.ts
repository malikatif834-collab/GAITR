/**
 * Shared types for the Tier-1 orchestrator (ADR 0005).
 *
 * The planner is deterministic — `OrchestratorState` → `PlannedAction[]`
 * is a pure function (see `planner.ts`). The dispatcher turns each
 * `PlannedAction` into a `runStage(...)` call.
 */

import type { Subject } from "@/lib/pipeline/types";

export type TickReason = "cron" | "manual" | "test";

export type PlannedActionKind =
  | "ingest"
  | "extract"
  | "correlate"
  | "map"
  | "report";

/** Why an action was planned — surfaced on the ops page next to each row. */
export type PlannerRuleId =
  | "ingest-stale-source"
  | "extract-missing-fingerprint"
  | "correlate-missing-run"
  | "map-missing-run"
  | "report-missing-run";

export type PlannedAction =
  | {
      kind: "ingest";
      sourceId: string;
      rule: "ingest-stale-source";
    }
  | {
      kind: "extract";
      incidentId: string;
      rule: "extract-missing-fingerprint";
    }
  | {
      kind: "correlate";
      incidentId: string;
      rule: "correlate-missing-run";
    }
  | {
      kind: "map";
      subject: Subject;
      rule: "map-missing-run";
    }
  | {
      kind: "report";
      subject: Subject;
      rule: "report-missing-run";
    };

export interface OrchestratorState {
  sources: {
    id: string;
    enabled: boolean;
    lastIngestAt: Date | null;
  }[];
  incidents: {
    id: string;
    hasFingerprint: boolean;
    hasCorrelateRun: boolean;
  }[];
  scenarios: {
    id: string;
    hasMapRun: boolean;
    hasReportRun: boolean;
  }[];
}

export interface Plan {
  tickId: string;
  reason: TickReason;
  ruleVersion: number;
  cap: number;
  actions: PlannedAction[];
  truncated: boolean;
}

export interface ActionResult {
  action: PlannedAction;
  agentRunId: string | null;
  status: "succeeded" | "failed" | "cached" | "running";
  errorMessage?: string;
}

export interface TickReport {
  tickId: string;
  reason: TickReason;
  decisionRecordId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  planned: number;
  dispatched: number;
  cached: number;
  failed: number;
  truncated: boolean;
  gateDecisions: number;
  evalRows: number;
  actions: ActionResult[];
}

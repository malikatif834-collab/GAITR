/**
 * Shared types for the six-stage pipeline (ADR 0003 D1). Each stage is a
 * typed function over the schema; every call writes one row to
 * `agent_runs` via `runStage()`, idempotency-keyed on the canonical
 * hash of its input.
 */

export type StageId =
  | "ingest"
  | "extract"
  | "correlate"
  | "synthesize"
  | "map"
  | "report";

export type StageStatus = "succeeded" | "failed" | "skipped";

/** Polymorphic subject — used by `map` and `report`. */
export type Subject =
  | { kind: "scenario"; id: string }
  | { kind: "fingerprint"; id: string }
  | { kind: "incident"; id: string };

/** Metadata returned by every stage invocation. */
export interface StageRunMeta {
  stageId: StageId;
  idempotencyKey: string;
  status: StageStatus;
  inputHash: string;
  outputHash: string | null;
  agentRunId: string;
  /** True when the run was a no-op replay of an existing agent_runs row. */
  cached: boolean;
}

export interface StageOutput<T> {
  meta: StageRunMeta;
  output: T;
}

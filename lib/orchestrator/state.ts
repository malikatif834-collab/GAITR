import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  agentRuns,
  alchemyScenarios,
  attackFingerprints,
  incidents,
  ingestionEvents,
  sourceRegistry,
} from "@/lib/db/schema";
import { canonicalHash } from "@/lib/alchemy/hash";
import type { StageId } from "@/lib/pipeline/types";
import type { OrchestratorState } from "./types";

/**
 * Read the snapshot of pipeline state the planner needs. One read fan-out
 * — the planner is pure, so this function is the only place that touches
 * the DB during state collection.
 *
 * "Has X run" is computed by recomputing each stage's idempotency key
 * (canonicalHash of its input shape) and checking for a succeeded
 * agent_runs row with that key. This matches the runStage idempotency
 * contract exactly, with no extra columns or shadow tables.
 */
export async function readState(): Promise<OrchestratorState> {
  const [sources, incs, scens] = await Promise.all([
    db
      .select({
        id: sourceRegistry.id,
        enabled: sourceRegistry.enabled,
      })
      .from(sourceRegistry),
    db
      .select({
        id: incidents.id,
      })
      .from(incidents),
    db
      .select({
        id: alchemyScenarios.id,
      })
      .from(alchemyScenarios),
  ]);

  const [lastIngestPerSource, fingerprintIncidentIds, succeededKeys] =
    await Promise.all([
      readLastIngestPerSource(sources.map((s) => s.id)),
      readIncidentsWithFingerprint(incs.map((i) => i.id)),
      readSucceededIdempotencyKeysPerStage(),
    ]);

  return {
    sources: sources.map((s) => ({
      id: s.id,
      enabled: s.enabled,
      lastIngestAt: lastIngestPerSource.get(s.id) ?? null,
    })),
    incidents: incs.map((i) => ({
      id: i.id,
      hasFingerprint: fingerprintIncidentIds.has(i.id),
      hasCorrelateRun: succeededKeys
        .get("correlate")!
        .has(correlateKey(i.id)),
    })),
    scenarios: scens.map((s) => ({
      id: s.id,
      hasMapRun: succeededKeys.get("map")!.has(mapScenarioKey(s.id)),
      hasReportRun: succeededKeys
        .get("report")!
        .has(reportScenarioKey(s.id)),
    })),
  };
}

async function readLastIngestPerSource(
  sourceIds: string[],
): Promise<Map<string, Date>> {
  if (sourceIds.length === 0) return new Map();
  const rows = await db
    .select({
      sourceId: ingestionEvents.sourceId,
      latest: sql<Date>`max(${ingestionEvents.createdAt})`,
    })
    .from(ingestionEvents)
    .where(inArray(ingestionEvents.sourceId, sourceIds))
    .groupBy(ingestionEvents.sourceId);
  return new Map(rows.map((r) => [r.sourceId, new Date(r.latest)] as const));
}

async function readIncidentsWithFingerprint(
  incidentIds: string[],
): Promise<Set<string>> {
  if (incidentIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ incidentId: attackFingerprints.incidentId })
    .from(attackFingerprints)
    .where(inArray(attackFingerprints.incidentId, incidentIds));
  return new Set(rows.map((r) => r.incidentId));
}

async function readSucceededIdempotencyKeysPerStage(): Promise<
  Map<StageId, Set<string>>
> {
  const rows = await db
    .select({
      stageId: agentRuns.stageId,
      idempotencyKey: agentRuns.idempotencyKey,
    })
    .from(agentRuns)
    .where(eq(agentRuns.status, "succeeded"));

  const byStage = new Map<StageId, Set<string>>();
  for (const stage of [
    "ingest",
    "extract",
    "correlate",
    "synthesize",
    "map",
    "report",
  ] as StageId[]) {
    byStage.set(stage, new Set());
  }
  for (const r of rows) {
    const stageId = r.stageId as StageId;
    if (!byStage.has(stageId)) byStage.set(stageId, new Set());
    byStage.get(stageId)!.add(r.idempotencyKey);
  }
  return byStage;
}

/* Idempotency key shapes — must mirror what each stage's runStage call
   produces. Keep in sync with the stage call sites in lib/pipeline/. */

export function ingestKey(sourceId: string): string {
  return canonicalHash({
    stageId: "ingest" as StageId,
    input: { sourceId },
  });
}

export function extractKey(incidentId: string): string {
  return canonicalHash({
    stageId: "extract" as StageId,
    input: { incidentId },
  });
}

export function correlateKey(incidentId: string): string {
  return canonicalHash({
    stageId: "correlate" as StageId,
    input: { incidentId },
  });
}

export function mapScenarioKey(scenarioId: string): string {
  return canonicalHash({
    stageId: "map" as StageId,
    input: { kind: "scenario", id: scenarioId },
  });
}

export function reportScenarioKey(scenarioId: string): string {
  return canonicalHash({
    stageId: "report" as StageId,
    input: { kind: "scenario", id: scenarioId },
  });
}

/** Re-export the and/eq helpers so internal modules can drop the import. */
export { and, eq };

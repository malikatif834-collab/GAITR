import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { agentRuns, decisionRecords } from "@/lib/db/schema";
import { canonicalHash } from "@/lib/alchemy/hash";
import type { StageId, StageOutput, StageRunMeta, StageStatus } from "./types";

/**
 * Wrap a stage's work in an idempotency-keyed agent_runs row. The
 * default idempotency key is the canonical hash of (stageId, input);
 * pass `opts.idempotencyOverride` to bypass the cache (ops "force
 * rerun" passes a fresh UUID so a re-run is forced even on cache hit).
 *
 * Lifecycle:
 *   - INSERT ... ON CONFLICT DO NOTHING claims the row at status="running".
 *     Concurrent callers all converge on one winner; losers re-read.
 *   - On the winner, the work runs and the row is UPDATEd to
 *     "succeeded" (with outputHash + decisionRecordId) or "failed"
 *     (with errorMessage).
 *   - Losers seeing a "succeeded" or "running" row return cached;
 *     losers seeing a "failed" row try to reclaim it (atomic
 *     failed→running UPDATE) for a retry — transient failures recover
 *     on the next planner tick.
 */
export interface RunStageOpts {
  idempotencyOverride?: string;
}

export async function runStage<TIn, TOut>(
  stageId: StageId,
  input: TIn,
  fn: () => Promise<{
    output: TOut;
    outputHashable: unknown;
    decisionRecordId?: string;
  }>,
  opts: RunStageOpts = {},
): Promise<StageOutput<TOut>> {
  const inputHash = canonicalHash({ stageId, input });
  const idempotencyKey = opts.idempotencyOverride ?? inputHash;

  const claimed = await db
    .insert(agentRuns)
    .values({
      stageId,
      idempotencyKey,
      status: "running",
      inputHash,
    })
    .onConflictDoNothing({
      target: [agentRuns.stageId, agentRuns.idempotencyKey],
    })
    .returning({ id: agentRuns.id });

  let claimedId: string;
  if (claimed.length > 0) {
    claimedId = claimed[0].id;
  } else {
    const reclaimed = await reclaimForRetry(stageId, idempotencyKey);
    if (reclaimed === "cached-succeeded" || reclaimed === "cached-running") {
      const [existing] = await db
        .select()
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.stageId, stageId),
            eq(agentRuns.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      return cachedReturn(existing, stageId, idempotencyKey);
    }
    if (reclaimed === "cached-failed") {
      const [existing] = await db
        .select()
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.stageId, stageId),
            eq(agentRuns.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      return cachedReturn(existing, stageId, idempotencyKey);
    }
    claimedId = reclaimed.id;
  }

  try {
    const { output, outputHashable, decisionRecordId } = await fn();
    const outputHash = canonicalHash(outputHashable);
    await db
      .update(agentRuns)
      .set({
        status: "succeeded",
        outputHash,
        completedAt: new Date(),
        decisionRecordId: decisionRecordId ?? null,
      })
      .where(eq(agentRuns.id, claimedId));
    const meta: StageRunMeta = {
      stageId,
      idempotencyKey,
      status: "succeeded",
      inputHash,
      outputHash,
      agentRunId: claimedId,
      cached: false,
    };
    return { meta, output };
  } catch (err) {
    await db
      .update(agentRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(agentRuns.id, claimedId));
    throw err;
  }
}

/**
 * Try to reclaim an existing row for execution. Returns the row id when
 * the caller now owns the work, or a cached marker when another caller
 * already owns / has finished it.
 */
async function reclaimForRetry(
  stageId: StageId,
  idempotencyKey: string,
): Promise<
  | { id: string }
  | "cached-succeeded"
  | "cached-running"
  | "cached-failed"
> {
  const [existing] = await db
    .select()
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.stageId, stageId),
        eq(agentRuns.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);

  if (!existing) {
    // Race lost but no row visible — shouldn't happen under repeatable-read
    // and we don't want an infinite loop. Surface as a cached-failed so the
    // caller treats it as "not my responsibility right now".
    return "cached-failed";
  }

  if (existing.status === "succeeded") return "cached-succeeded";
  if (existing.status === "running") return "cached-running";

  // status === "failed": try to atomically flip failed→running so a single
  // retry winner emerges. Losers see status="running" on re-read.
  const reclaimed = await db
    .update(agentRuns)
    .set({
      status: "running",
      startedAt: new Date(),
      completedAt: null,
      errorMessage: null,
      outputHash: null,
    })
    .where(and(eq(agentRuns.id, existing.id), eq(agentRuns.status, "failed")))
    .returning({ id: agentRuns.id });

  if (reclaimed.length > 0) return { id: reclaimed[0].id };
  // Another caller reclaimed first — they own the retry now.
  return "cached-running";
}

function cachedReturn<TOut>(
  existing: typeof agentRuns.$inferSelect,
  stageId: StageId,
  idempotencyKey: string,
): StageOutput<TOut> {
  const meta: StageRunMeta = {
    stageId,
    idempotencyKey,
    status: existing.status as StageStatus,
    inputHash: existing.inputHash,
    outputHash: existing.outputHash,
    agentRunId: existing.id,
    cached: true,
  };
  return { meta, output: null as unknown as TOut };
}

/**
 * Create a stub-provider decision record for stages whose schema requires
 * one (attack_fingerprints, saif_mappings, briefs). The real provider
 * path goes through `lib/alchemy/synthesize.ts`-style flow; stub is what
 * Phase 2 seeds against.
 */
export async function createStubDecisionRecord(opts: {
  agentName: string;
  inputHash: string;
  outputHash: string;
}): Promise<string> {
  const [row] = await db
    .insert(decisionRecords)
    .values({
      agentName: opts.agentName,
      promptVersion: "phase2-stub@v1",
      modelId: "stub-deterministic@v1",
      modelParams: { provider: "stub" },
      inputHash: opts.inputHash,
      outputHash: opts.outputHash,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: "0.000000",
    })
    .returning({ id: decisionRecords.id });
  return row.id;
}

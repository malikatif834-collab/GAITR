import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { agentRuns, decisionRecords } from "@/lib/db/schema";
import { canonicalHash } from "@/lib/alchemy/hash";
import type { StageId, StageOutput, StageRunMeta } from "./types";

/**
 * Wrap a stage's work in an idempotency-keyed agent_runs row. The
 * idempotency key is the canonical hash of (stageId, input); a previous
 * succeeded row short-circuits the call. Failures are recorded with an
 * error message and rethrown.
 *
 * The check + insert is not atomic — two concurrent callers can both
 * pass the existence check and both write, hitting the
 * `(stage_id, idempotency_key)` unique constraint. Phase 2 is
 * single-process; the Phase 3 orchestrator (ADR 0005) will add advisory
 * locks or `INSERT ... ON CONFLICT` to harden the race.
 */
export async function runStage<TIn, TOut>(
  stageId: StageId,
  input: TIn,
  fn: () => Promise<{ output: TOut; outputHashable: unknown }>,
): Promise<StageOutput<TOut>> {
  const inputHash = canonicalHash({ stageId, input });
  const idempotencyKey = inputHash;

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

  if (existing && existing.status === "succeeded") {
    const meta: StageRunMeta = {
      stageId,
      idempotencyKey,
      status: "succeeded",
      inputHash: existing.inputHash,
      outputHash: existing.outputHash,
      agentRunId: existing.id,
      cached: true,
    };
    return { meta, output: null as unknown as TOut };
  }

  try {
    const { output, outputHashable } = await fn();
    const outputHash = canonicalHash(outputHashable);
    const [row] = await db
      .insert(agentRuns)
      .values({
        stageId,
        idempotencyKey,
        status: "succeeded",
        inputHash,
        outputHash,
        completedAt: new Date(),
      })
      .returning({ id: agentRuns.id });
    return {
      meta: {
        stageId,
        idempotencyKey,
        status: "succeeded",
        inputHash,
        outputHash,
        agentRunId: row.id,
        cached: false,
      },
      output,
    };
  } catch (err) {
    await db.insert(agentRuns).values({
      stageId,
      idempotencyKey,
      status: "failed",
      inputHash,
      outputHash: null,
      errorMessage: err instanceof Error ? err.message : String(err),
      completedAt: new Date(),
    });
    throw err;
  }
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

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { agentRuns, decisionRecords } from "@/lib/db/schema";
import { runStage } from "./run";
import type { StageId } from "./types";

/* Race / lifecycle / idempotencyOverride coverage for runStage.
   Skipped when DATABASE_URL is unset — matches the seedPipelineRuns
   smoke-test pattern; in CI / local dev with Postgres up these run for
   real and exercise the ON CONFLICT path. */

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

const TEST_STAGE = "extract" as StageId; // any valid StageId works
let createdAgentRunIds: string[] = [];
let createdDecisionIds: string[] = [];

async function makeStubDecision(): Promise<string> {
  const [row] = await db
    .insert(decisionRecords)
    .values({
      agentName: "run-test",
      promptVersion: "test@v1",
      modelId: "test",
      modelParams: {},
      inputHash: "test",
      outputHash: "test",
      promptTokens: 0,
      completionTokens: 0,
      costUsd: "0.000000",
    })
    .returning({ id: decisionRecords.id });
  createdDecisionIds.push(row.id);
  return row.id;
}

d("runStage — race + lifecycle + override", () => {
  beforeAll(() => {
    createdAgentRunIds = [];
    createdDecisionIds = [];
  });

  afterAll(async () => {
    // Only delete the specific rows we created — never blanket-delete by
    // stage_id, which would clobber seed data and any concurrent runs.
    if (createdAgentRunIds.length) {
      await db
        .delete(agentRuns)
        .where(inArray(agentRuns.id, createdAgentRunIds))
        .catch(() => undefined);
    }
    if (createdDecisionIds.length) {
      await db
        .delete(decisionRecords)
        .where(inArray(decisionRecords.id, createdDecisionIds))
        .catch(() => undefined);
    }
  });

  it("first call inserts running→succeeded; second call returns cached + links decision_record", async () => {
    const input = { testCase: `cache-${Date.now()}-${Math.random()}` };
    const decisionId = await makeStubDecision();

    const first = await runStage(TEST_STAGE, input, async () => ({
      output: { value: 1 },
      outputHashable: { value: 1 },
      decisionRecordId: decisionId,
    }));
    createdAgentRunIds.push(first.meta.agentRunId);

    expect(first.meta.cached).toBe(false);
    expect(first.meta.status).toBe("succeeded");
    expect(first.output).toEqual({ value: 1 });

    const [row] = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, first.meta.agentRunId))
      .limit(1);
    expect(row.status).toBe("succeeded");
    expect(row.decisionRecordId).toBe(decisionId);
    expect(row.completedAt).not.toBeNull();

    // Second call with same input should short-circuit and NOT execute.
    let executions = 0;
    const second = await runStage(TEST_STAGE, input, async () => {
      executions += 1;
      return { output: { value: 999 }, outputHashable: { value: 999 } };
    });

    expect(executions).toBe(0);
    expect(second.meta.cached).toBe(true);
    expect(second.meta.status).toBe("succeeded");
    expect(second.meta.agentRunId).toBe(first.meta.agentRunId);
  });

  it("two concurrent calls produce exactly one execution; loser returns cached", async () => {
    const input = { testCase: `race-${Date.now()}-${Math.random()}` };
    let executions = 0;

    const work = async () => {
      executions += 1;
      // Brief async hop so both calls have time to enter the claim phase.
      await new Promise((r) => setTimeout(r, 5));
      return { output: { v: executions }, outputHashable: { v: executions } };
    };

    const [a, b] = await Promise.all([
      runStage(TEST_STAGE, input, work),
      runStage(TEST_STAGE, input, work),
    ]);

    expect(executions).toBe(1);
    expect(a.meta.agentRunId).toBe(b.meta.agentRunId);
    expect([a.meta.cached, b.meta.cached]).toContain(true);
    expect([a.meta.cached, b.meta.cached]).toContain(false);

    createdAgentRunIds.push(a.meta.agentRunId);

    // Confirm DB has exactly one row for this idempotency key.
    const rows = await db
      .select()
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.stageId, TEST_STAGE),
          eq(agentRuns.idempotencyKey, a.meta.idempotencyKey),
        ),
      );
    expect(rows).toHaveLength(1);
  });

  it("idempotencyOverride forces a fresh row even on identical input", async () => {
    const input = { testCase: `override-${Date.now()}-${Math.random()}` };

    const first = await runStage(TEST_STAGE, input, async () => ({
      output: { v: 1 },
      outputHashable: { v: 1 },
    }));
    createdAgentRunIds.push(first.meta.agentRunId);

    const overrideKey = `force-${crypto.randomUUID()}`;
    const second = await runStage(
      TEST_STAGE,
      input,
      async () => ({ output: { v: 2 }, outputHashable: { v: 2 } }),
      { idempotencyOverride: overrideKey },
    );
    createdAgentRunIds.push(second.meta.agentRunId);

    expect(second.meta.cached).toBe(false);
    expect(second.meta.agentRunId).not.toBe(first.meta.agentRunId);
    expect(second.meta.idempotencyKey).toBe(overrideKey);
    expect(second.output).toEqual({ v: 2 });
  });
});

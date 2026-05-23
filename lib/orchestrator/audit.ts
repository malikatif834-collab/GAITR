import { db } from "@/lib/db/client";
import { decisionRecords } from "@/lib/db/schema";
import { canonicalHash } from "@/lib/alchemy/hash";
import type { OrchestratorState, Plan } from "./types";

export const ORCHESTRATOR_PROMPT_VERSION = "orchestratorPlanner@1.0.0";
export const ORCHESTRATOR_MODEL_ID = "deterministic@v1";

/**
 * One decision_records row per tick — the planner's "what I decided to
 * do and why" audit log. Per-action audit is already covered by
 * runStage, which links each agent_run's decision_record_id when the
 * stage produces one.
 */
export async function writeOrchestratorDecision(opts: {
  state: OrchestratorState;
  plan: Plan;
}): Promise<string> {
  const inputHash = canonicalHash({ state: opts.state });
  const outputHash = canonicalHash({
    actions: opts.plan.actions.map((a) => ({
      kind: a.kind,
      rule: a.rule,
      target: actionTarget(a),
    })),
    truncated: opts.plan.truncated,
  });

  const [row] = await db
    .insert(decisionRecords)
    .values({
      agentName: "orchestrator",
      promptVersion: ORCHESTRATOR_PROMPT_VERSION,
      modelId: ORCHESTRATOR_MODEL_ID,
      modelParams: {
        provider: "deterministic",
        reason: opts.plan.reason,
        ruleVersion: opts.plan.ruleVersion,
        cap: opts.plan.cap,
      },
      inputHash,
      outputHash,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: "0.000000",
    })
    .returning({ id: decisionRecords.id });

  return row.id;
}

function actionTarget(a: Plan["actions"][number]): string {
  switch (a.kind) {
    case "ingest":
      return a.sourceId;
    case "extract":
    case "correlate":
      return a.incidentId;
    case "map":
    case "report":
      return a.subject.id;
  }
}

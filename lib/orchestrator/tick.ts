import { readState } from "./state";
import {
  buildPlan,
  PLANNER_ACTION_CAP,
  PLANNER_RULE_VERSION,
} from "./planner";
import { dispatchAction, type DispatchedAction } from "./dispatcher";
import { writeOrchestratorDecision } from "./audit";
import { computeMetrics } from "./eval";
import type { TickReason, TickReport } from "./types";

/**
 * One tick = read state → build plan → write decision record → dispatch
 * each action (each routes its outputs through the governance gate) →
 * write 3 eval metrics → return TickReport.
 *
 * Same entry point powers /api/cron/orchestrator/tick and /api/ops/tick
 * (ADR 0005 D5).
 */
export async function runTick(opts: {
  reason: TickReason;
  cap?: number;
}): Promise<TickReport> {
  const startedAt = new Date();
  const cap = opts.cap ?? PLANNER_ACTION_CAP;

  const state = await readState();
  const { actions, truncated } = buildPlan(state, startedAt, cap);

  const plan = {
    tickId: crypto.randomUUID(),
    reason: opts.reason,
    ruleVersion: PLANNER_RULE_VERSION,
    cap,
    actions,
    truncated,
  };

  const decisionRecordId = await writeOrchestratorDecision({ state, plan });

  const results: DispatchedAction[] = [];
  for (const action of actions) {
    results.push(await dispatchAction(action));
  }

  let evalRows = 0;
  try {
    const metrics = await computeMetrics(startedAt);
    evalRows = metrics.length;
  } catch (err) {
    // Eval failure shouldn't break the tick — log and continue. The
    // missing window is visible on the scorecard (gap in the sparkline).
    console.warn(
      "[orchestrator] eval write failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  const gateDecisions = results.reduce(
    (acc, r) => acc + r.gateDecisions.length,
    0,
  );

  const completedAt = new Date();
  return {
    tickId: plan.tickId,
    reason: opts.reason,
    decisionRecordId,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    planned: actions.length,
    dispatched: results.filter((r) => r.status === "succeeded").length,
    cached: results.filter((r) => r.status === "cached").length,
    failed: results.filter((r) => r.status === "failed").length,
    truncated,
    gateDecisions,
    evalRows,
    actions: results,
  };
}

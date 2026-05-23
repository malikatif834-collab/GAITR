import { readState } from "./state";
import {
  buildPlan,
  PLANNER_ACTION_CAP,
  PLANNER_RULE_VERSION,
} from "./planner";
import { dispatchAction } from "./dispatcher";
import { writeOrchestratorDecision } from "./audit";
import type { ActionResult, TickReason, TickReport } from "./types";

/**
 * One tick = read state → build plan → write decision record → dispatch
 * each action → return a TickReport. The same entry point powers the
 * Vercel cron route and the operator "Run a tick" button (ADR 0005 D1).
 *
 * Per ADR 0005 D8, every tick also writes 3 eval_results rows; the gate
 * is invoked per-action by the dispatcher path's stage outputs in the
 * Phase-3 commit that follows. For commit 2 (planner+dispatcher only),
 * gateDecisions and evalRows are reported as 0; commit 3 wires the gate
 * + eval modules and bumps both.
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

  const results: ActionResult[] = [];
  for (const action of actions) {
    results.push(await dispatchAction(action));
  }

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
    gateDecisions: 0,
    evalRows: 0,
    actions: results,
  };
}

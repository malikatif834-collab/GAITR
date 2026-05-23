# Orchestrator — agent spec

- **Version**: `orchestrator@1.0.0`
- **Defined by**: ADR 0003 D1 (placement), ADR 0005 (implementation).
- **Implemented in**: Phase 3 — `lib/orchestrator/`.

## 1. Identity & role

The orchestrator is GAITR's single Tier-1 controller. It runs the
pipeline loop: every 15 minutes (Vercel Cron) — and on demand from
operators — it reads pipeline state, plans a capped list of stage
dispatches, writes a decision-record audit row, dispatches each action
through `runStage`, routes each produced artifact through the
governance gate, and writes three eval-metric rows. It is *the* agent
whose job is to keep the platform running without anyone watching.

In v1 the orchestrator's planner is **deterministic** — a five-rule
table, no LLM. It is still an agent (ADR 0004 D1: a component is an
agent only if it plans a multi-step course of action and chooses its
own tool calls — the orchestrator does, even with a deterministic
policy). The system prompt section is N/A in v1 and is filled in when
the planner gains a learned component.

## 2. Tier & type

Tier 1, autonomous controller. Single in-process planner+dispatcher —
no microservice, no worker pool. One cron tick = one `runTick(...)`
invocation completing inside a single Vercel function call.

## 3. Capabilities (tools)

| Tool | Purpose |
|---|---|
| `readState` | Single DB read fan-out over `source_registry`, `incidents`, `attack_fingerprints`, `agent_runs`, `alchemy_scenarios`. |
| `dispatchStage` | Invoke any one of the six pipeline stages via `runStage`. |
| `routeToGate` | Call the governance gate's per-subject `routeX` functions. |
| `writeOrchestratorDecision` | Insert one `decision_records` row per tick (`agent_name='orchestrator'`). |
| `computeMetrics` | Write the three v1 eval rows. |

**Must NOT have**: any direct write to a published table
(`ai_tools`, `incidents`, `attack_fingerprints`, `saif_mappings`,
`briefs`) — every write goes through a `runStage` call which writes
its own agent_run row. No HTTP / network access in the planner —
`ingest` is the only stage that touches the network, and in v1 it
only ever reads from fixture sources (live HTTP gated to Phase 5).

## 4. I/O contract

**Input** — `{ reason: "cron" | "manual" | "test", cap?: number }`.

**Output** — `TickReport` (see `lib/orchestrator/types.ts`): tick id,
linked decision-record id, planned / dispatched / cached / failed
counts, truncated flag, gate-decision count, eval-row count, per-action
details with their `agentRunId` and `gateDecisions`.

**Tables written** (by the orchestrator itself, not its dispatches):
`decision_records` (one row per tick), `eval_results` (three rows per
tick), `review_queue` (transitively, via the gate). Stage outputs land
their own rows via `runStage`.

## 5. System prompt

**N/A in v1.** The planner is a rule table in `lib/orchestrator/planner.ts`
— no LLM call. When the planner gains a learned component (e.g.
priority scoring on coverage gaps, ADR 0006+), this section gets the
prompt module path and `orchestrator@x.y.z` version.

## 6. Constraints & refusal rules (negative prompts)

- **Cap 20 actions per tick.** Remainder picked up next tick. Bounds
  one Vercel function invocation; flagged on the TickReport as
  `truncated: true`.
- **Never autonomously dispatch `synthesize` in v1.** Synthesize is
  the largest prompt-injection surface (CRITIQUE A1). It stays
  operator-initiated (the Alchemy Engine UI). The planner can
  dispatch `map` and `report` against operator-initiated scenarios
  it observes — it does not decide which tool combinations to
  synthesize.
- **Never dispatch `ingest` against a non-fixture source pre-Phase-5.**
  Live HTTP ingestion is gated behind `/security-review`. v1 ingests
  only deterministic fixture payloads.
- **Never publish without writing a gate decision.** Every produced
  artifact (fingerprint, mapping, brief, scenario) goes through
  `lib/orchestrator/gate.ts` — the tier determines whether a
  `review_queue` row is written and whether the artifact is
  surfaced. No back-door publishing.
- **Never insert duplicate `review_queue` rows for cached actions.**
  Cached results skip gate routing; only newly-executed actions write
  governance rows.
- **Tick failure isolation.** Eval-writer failure doesn't block the
  tick (logged + reported as gap in scorecard). Per-action failure
  doesn't block the tick (logged on the TickReport; retry happens
  via `runStage`'s atomic failed→running reclaim on the next tick).

## 7. Few-shot examples

The planner is deterministic, so the "examples" are the unit-test
fixtures in `lib/orchestrator/planner.test.ts`:

1. **Fresh deploy** — 12 enabled sources, no past runs → plans 12
   ingest actions (capped to 20 cleanly).
2. **Steady state** — every incident has a fingerprint, every scenario
   has map + report runs → plans nothing.
3. **Manual cleanup** — operator deletes one fingerprint → next tick
   plans one extract for the affected incident.
4. **Truncation** — 25 incidents without fingerprints → plans 20
   extracts, `truncated: true`; next tick picks up the remaining 5.

## 8. Eval set & acceptance threshold

The planner unit tests are the eval set in v1 — they're deterministic
fixtures, expected actions exactly known, acceptance threshold 100%.

When the planner gains a learned component, this becomes a labelled
regression set on `(state → expected-action-set)` pairs with a per-rule
precision/recall target, gated by CRITIQUE G3.

## 9. Model assignment

**Deterministic, no model.** Resolved through `lib/orchestrator/planner.ts`
constants — never hardcoded in a model client. When a learned planner
arrives, it goes through `lib/alchemy/providers/` (CRITIQUE C5) like
every other agent.

## 10. Change log

| Version | Date | Change |
|---|---|---|
| `orchestrator@1.0.0` | 2026-05-23 | Initial deterministic planner (ADR 0005). Five rules, 20-action cap, 15-minute cron cadence. |

# ADR 0005 — Tier-1 orchestrator and the Agent Operations page

- **Status**: Accepted — signed off by the user 2026-05-23
- **Date**: 2026-05-23
- **Branch**: `claude/review-gaitr-file-KK0iC`
- **Extends**: ADR 0003 (full-platform architecture) D1 (Tier 1 orchestrator)
  and D3 (scheduling backend, deferred). Implements ADR 0004 D5 (thin Agent
  Operations page).

## Context

Phase 2 (ADR 0003 D1) shipped the six typed pipeline stages and the
`runStage` wrapper that writes `agent_runs` rows keyed on
`(stage_id, idempotency_key)`. Nothing yet *drives* those stages
autonomously — the seed invokes them by hand, the Command Center's
`OrchestratorStatus` card is a "Standby" placeholder, and four
orchestration tables (`review_queue`, `eval_results`, `feedback_events`,
plus `decision_records` — which is *written* to but its FK from
`agent_runs.decisionRecordId` is never populated) sit empty.

Three design questions were deferred to this ADR:

1. **Scheduling backend** — Vercel Cron vs. BullMQ + Upstash Redis
   (ADR 0003 D3 explicitly punted).
2. **`runStage` race condition** — `lib/pipeline/run.ts:27–64` does a
   SELECT-then-INSERT, so two concurrent callers can both pass the
   existence check before hitting the unique constraint.
3. **Embeddings infrastructure** for attribution-grade `correlate`.

The user picked the recommended defaults (2026-05-23): Vercel Cron, an
env-var bearer token for ops gating, and embeddings deferred to its own
future ADR.

The Agent Operations page is the surface ADR 0004 D5 promised:
domain-specific eval scorecard, decision-record explainability, and
operator run-controls — three things off-the-shelf observability cannot
do.

## Decision

### D1 — Tier 1 is one in-process planner+dispatcher

`lib/orchestrator/` houses an eight-module slice: `types`, `state`,
`planner`, `dispatcher`, `gate`, `eval`, `audit`, `tick`. One cron poke
(or one operator click) = one `runTick({reason})` call = read state →
build plan → dispatch → route gate → write metrics → return a
`TickReport`. No daemon, no worker pool, no microservice. The orchestrator
*is* an agent (ADR 0004 D1) but in v1 has no LLM — the planner is a
deterministic rule table. When a learned component arrives, it slots into
`planner.ts` and gains the standard agent-spec sections (system prompt,
eval set).

### D2 — Vercel Cron for v1

`vercel.json` gains a single cron entry at `*/15 * * * *` against
`/api/cron/orchestrator/tick`. The route checks the Vercel-injected
`CRON_SECRET` bearer header and rejects with 401 otherwise. 15 minutes
is the right cadence while the stub LLM is the default — no token spend,
and the planner completes in seconds.

Rejected: **BullMQ + Upstash Redis.** Right tool for sub-minute cadence,
backpressure on long external fetches, or fan-out parallelism — none of
which we need until Phase 5 live ingestion may burst past the 300s
function-invocation cap. Revisit in a later ADR if and when that lands.

Rejected: **No scheduler; ops-API-only triggers.** Ships a "controller"
that isn't actually autonomous. The whole point of Tier 1 is that the
loop runs whether or not an operator is watching.

### D3 — `runStage` race fix: atomic claim + lifecycle states

Replace the SELECT-then-INSERT at `lib/pipeline/run.ts:27–64` with one
insert at status `"running"` using drizzle-orm's
`.onConflictDoNothing({ target: [agentRuns.stageId, agentRuns.idempotencyKey] }).returning({ id })`.
Empty return = lost the race; re-select the winner. The work runs, then
an UPDATE flips the row to `succeeded` (or `failed`) and links the
`decisionRecordId`. Two material consequences:

1. Concurrent callers can no longer both insert — the constraint is now
   the *contention point*, not the *failure mode*.
2. Rows now have a `"running"` state, which gives the ops page a
   "currently executing" surface. The pre-Phase-3 lifecycle only had
   terminal states.

Rejected: **Postgres advisory locks.** Need a session, don't compose
with the connection-per-request pool we use, and bring no benefit over
the `ON CONFLICT` path that already does what we need atomically.

### D4 — Embeddings infrastructure: deferred

Attribution-grade `correlate` needs pgvector + an embedding provider +
a backfill job + a re-ranking strategy — none of which is on the path
of "make the orchestrator drive the loop." It gets its own ADR when
Phase 4 / 5 picks it up. v1's orchestrator-driven re-correlate keeps
using `lib/pipeline/correlate.ts`'s capability-overlap path
(`match_type=capability`, ≤ 0.85 confidence ceiling); attribution links
keep arriving by hand-seed.

### D5 — Operator API + `/ops` route

Under `/api/ops/*` (env-var token):

- `POST /api/ops/tick` — manual tick.
- `POST /api/ops/stages/:stageId/trigger` — body
  `{subjectKind, subjectId, force?}`. `force=true` passes a fresh
  `idempotencyOverride` to bypass the cache. `ingest` against any source
  with `kind != "fixture"` is server-side blocked (Phase 5 / A2).
- `POST /api/ops/runs/:id/replay` — re-dispatches the original input
  with fresh idempotency. Old row preserved.
- `POST /api/ops/runs/:id/retry` — same, restricted to `status=failed`.
  Split from replay for audit clarity ("retry was a failure recovery";
  "replay was a curiosity / regression check").
- `GET /api/ops/runs` — paginated list with `stage`, `status`,
  `orchestratorOnly` filters.
- `GET /api/ops/runs/:id` — agent_run joined to its decision_record.
- `GET /api/ops/eval` — latest value per `(stage_id, metric)`.

The page at `/ops` renders three sections (D5 mirrors ADR 0004 D5):
scorecard (top), runs explorer (middle), run-controls (bottom). The
runs-explorer right pane reuses the existing
`components/provenance-drawer.tsx` body, split out into
`components/provenance-fields.tsx` for reuse.

### D6 — Auth: env-var bearer token

`middleware.ts` at the repo root matches `/ops/:path*` and
`/api/ops/:path*`. Reads `OPS_ADMIN_TOKEN` from env; **unset → 404 on
every match** (the surface doesn't exist when not provisioned, which is
the right default for public previews). Pages check a cookie set by
`POST /api/ops/login`; APIs check `Authorization: Bearer`. Cookie:
`HttpOnly`, `Secure`, `SameSite=Strict`, 12h TTL.

This is deliberately minimal. CRITIQUE H1 RBAC + the `users` table +
Auth.js sessions land in Phase 5 / ADR 0006. The middleware contract
stays the same; the token gets replaced by a session.

Rejected: **Vercel Password Protection.** Team-plan-only and protects
the *whole deploy* — would break public access to the rest of the
platform. Wrong tool.

Rejected: **Real Auth.js now.** Partially overlaps with the Phase 5
RBAC plan; cost not justified for a single-operator preview.

### D7 — Governance gate is pure code

`lib/orchestrator/gate.ts` exports `routeToGate(subject): GateDecision`
called by the dispatcher after each publishable artifact. The tier table
is data, not config — checked into the repo, versioned, reviewable as a
diff:

| Subject | Trust signal | Tier | Effect |
|---|---|---|---|
| `scenario` (operator UI) | source=operator | `auto-publish-with-audit` | queue row, status=approved |
| `scenario` (autonomous; **not v1**) | source=orchestrator | `approval-required` | queue row, status=pending |
| `fingerprint` | parent source trust ≥ `official` | `auto-publish` | none |
| `fingerprint` | trust = `community` | `approval-required` | queue row |
| `saif_mapping` | confidence ≥ 0.70 | `auto-publish-with-audit` | audit row |
| `saif_mapping` | confidence < 0.70 | `approval-required` | queue row |
| `brief` | always | `auto-publish-with-audit` | audit row |
| `incident_tool_link` | `match_type=capability` | `metrics-only` | none, counted in eval |
| `incident_tool_link` | `match_type=attribution` | `auto-publish` | none |

`approval-required` rows are written but stay hidden until Phase 4 ships
the Review Queue UI — correct ordering (producer first, consumer next).
In v1 the planner never autonomously dispatches synthesize, so the
"autonomous scenario → approval-required" row never fires; the row is in
the table so Phase 4 inherits a complete spec.

### D8 — Eval v1: three deterministic metrics

`lib/orchestrator/eval.ts` writes one `eval_results` row per metric per
tick, `window_start = now - 24h`, `window_end = now`:

1. `extract.fingerprint_coverage` — `count(incidents with fingerprint) / count(incidents)`.
2. `correlate.capability_link_yield` — mean `linksAdded` per correlate run in window.
3. `map.controls_per_scenario` — mean `count(saif_mappings)` per scenario in window.

**Deferred**: `synthesize.reviewer_override_rate` needs Phase 4 review
data; `map.expert_agreement` needs a Phase 5 labelled holdout set. The
scorecard surfaces both as greyed-out placeholders with the deferral
reason inline.

## Data model additions

None. Phase 2 shipped every table this ADR needs. Two columns are now
*used* that weren't before:

- `agent_runs.decisionRecordId` (nullable FK to `decision_records`) is
  populated for every stage that creates a decision record. Closes the
  audit gap.
- `agent_runs.status` gains the value `"running"` (lifecycle change,
  not a schema change — the column is text).

## Build sequencing

Six commits, in order, each green on `pnpm test && pnpm build`:

1. `feat(orchestrator): atomic runStage with ON CONFLICT + decision_record link`
2. `feat(orchestrator): planner + state + dispatcher (deterministic)`
3. `feat(orchestrator): governance gate + eval metric writer`
4. `feat(orchestrator): Vercel cron tick endpoint + ops middleware`
5. `feat(ops): operator API — trigger, replay, retry, runs explorer`
6. `feat(ops): Agent Operations page — scorecard, explorer, run-controls`

This ADR lands as commit 0.

## Alternatives considered

- **BullMQ + Upstash Redis as the scheduler.** Rejected as overkill for
  v1 (D2).
- **No scheduler; manual tick only.** Rejected — Tier 1 must be
  autonomous to be Tier 1 (D2).
- **Postgres advisory locks for the race.** Rejected — `ON CONFLICT` is
  the smaller, correct fix (D3).
- **Bundle embeddings into this ADR.** Rejected — independent decision
  surface with its own model + dimensionality + reranking choices; ADR
  0005 stays scoped (D4).
- **Real Auth.js now.** Rejected — Phase 5 will do it properly with
  RBAC; v1 token is the right scope (D6).
- **A single combined `replay` endpoint.** Rejected — the failure-recovery
  and curiosity-rerun semantics are different; keeping them split is
  cheap and makes the audit log readable (D5).
- **Five eval metrics in v1.** Rejected — two require data we won't
  have until Phase 4/5; shipping placeholders is more honest than
  shipping NaN values (D8).

## Consequences

- The platform is **actually autonomous** at the loop level — a tick
  runs every 15 minutes whether anyone is watching.
- Every `agent_runs` row now links back to its `decision_records` row,
  so the audit trail B1 promised is complete end-to-end.
- The `runStage` race is closed; concurrent callers (cron + manual tick
  + Phase 5 live ingest) all converge on one row per idempotency key.
- `review_queue` starts accumulating rows — Phase 4 inherits a populated
  table to design the Review Queue UI against, rather than an empty
  scaffold.
- `eval_results` starts accumulating rows — the scorecard immediately
  has 14 daily windows of data after two weeks of cron ticks.
- The `/ops` page is a real operator surface, not a placeholder. The
  Command Center's `OrchestratorStatus` card flips from "Standby" to
  "Operational · last tick Xm ago".
- The Phase 4 plan reorders slightly: the Review Queue UI (which
  consumes the `approval-required` rows the gate writes) is the first
  Phase 4 slice, since Phase 3 finally produces those rows.

## Open questions for the user

None outstanding. The three deferred questions from ADR 0003 D3 +
CLAUDE.md are resolved by D2, D3, D4. The remaining open ADR is the
Analyst Console (ADR 0004 still defers it).

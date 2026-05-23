# Governance gate — service spec

> **Not an agent.** ADR 0003 D1 calls the governance gate "pure code"
> and ADR 0004 D1 fixes the bar that "a component is an agent only if
> it plans a multi-step course of action and chooses its own tool
> calls." The governance gate plans nothing — it looks up trust
> signals and writes review-queue rows. It lives under
> `docs/services/` so `docs/agents/` stays agent-only as promised.

## Purpose

After a pipeline stage writes a publishable artifact (fingerprint,
saif_mapping, brief, scenario, incident_tool_link), the gate decides
which of four tiers the artifact lands in:

- **`auto-publish`** — surfaces immediately, no queue row.
- **`auto-publish-with-audit`** — surfaces immediately, queue row at
  `status="approved"` for the audit trail.
- **`approval-required`** — queue row at `status="pending"`. Stays
  hidden from the public catalog until the Phase 4 Review Queue UI
  (built on this gate's output) consumes it.
- **`metrics-only`** — no queue row, no public surface; counted in the
  eval scorecard only.

Tier names match CRITIQUE C4's action-truthful renames.

## Code pointer

`lib/orchestrator/gate.ts`. Called by `lib/orchestrator/dispatcher.ts`
after each successfully-executed (non-cached) action. Coverage:
`lib/orchestrator/gate.test.ts` — one case per row of the tier table
below.

## Tier table

The table is the spec. Changes land as code review + an ADR amendment
(currently ADR 0005 D7).

| Subject | Trust signal | Tier | Effect |
|---|---|---|---|
| `fingerprint` | parent incident's source `trust` in (`official`, `verified`) | `auto-publish` | none |
| `fingerprint` | trust = `community` | `approval-required` | queue row `status=pending` |
| `saif_mapping` | confidence ≥ `SAIF_MAPPING_CONFIDENCE_THRESHOLD` (0.70) | `auto-publish-with-audit` | queue row `status=approved` |
| `saif_mapping` | confidence < 0.70 | `approval-required` | queue row `status=pending` |
| `brief` | always | `auto-publish-with-audit` | queue row `status=approved` |
| `scenario` (operator UI) | origin=`operator` | `auto-publish-with-audit` | queue row `status=approved` |
| `scenario` (autonomous; **not v1**) | origin=`orchestrator` | `approval-required` | queue row `status=pending` |
| `incident_tool_link` | `match_type=capability` | `metrics-only` | none |
| `incident_tool_link` | `match_type=attribution` | `auto-publish` | none |

## Inputs / outputs

**Inputs**: one freshly-produced artifact id (UUID) per call. The gate
looks up its own trust signals from the existing tables
(`source_registry.trust`, `saif_mappings.confidence`, etc.) — callers
never pass policy data.

**Outputs**: a `GateDecision` object (`{ subjectKind, subjectId, tier,
reviewQueueId, reason }`). Surfaced on the ops page next to the
artifact, and the `reason` string is how an auditor explains why a
given row sits in `review_queue`.

**Tables written**: `review_queue` only. Never modifies the artifact
itself.

## Promotion / demotion of a tier

1. Open a PR with the rule change in `lib/orchestrator/gate.ts`.
2. Update `gate.test.ts` so the regression covers the new rule.
3. Amend ADR 0005 D7 (or write a follow-up ADR) noting the rule shift
   + rationale.
4. Code review approves; the change lands as a diff. No config flag,
   no runtime toggle — governance decisions are not feature flags.

## Phase boundaries

- **Phase 3 (this commit):** gate is shipped + tested + writing rows.
  Consumer of `approval-required` rows is the Phase 4 Review Queue UI;
  until then those artifacts sit in the queue and are not surfaced.
  Producer-first is the correct ordering — Phase 4 inherits a populated
  table to design the UI against, not an empty scaffold.
- **Phase 4:** Review Queue UI; reviewer actions write `feedback_events`
  rows that close the loop back into eval / prompt updates (CRITIQUE G1).
- **Phase 5:** Auth swap — the env-var token from ADR 0005 D6 becomes a
  real session, `reviewQueue.reviewerId` carries a real `users.id`.

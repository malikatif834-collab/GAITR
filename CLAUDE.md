# GAITR — Project Briefing

This file is auto-loaded at the start of every Claude Code session. It is the
durable memory layer for this project. Keep it accurate. If a fact here drifts
from reality, future sessions will start from a wrong premise.

## What GAITR is (one paragraph)

GAITR (Global AI Threat Register) is an explainable threat intelligence
platform that operationalizes Google's Secure AI Framework (SAIF). It catalogs
AI tools, links them to real-world incidents, extracts attack fingerprints,
synthesizes emergent multi-tool threat scenarios via the **Alchemy Engine**,
and maps everything back to specific SAIF controls — all driven by a
multi-agent AI pipeline under tiered human governance. A more advanced version
is already shipped at **gaitr.ai** (built on Replit). This repo is a
clean-room workspace for design critique and net-new builds — overlap with the
Replit version is acceptable.

## File map

| Path | What's there |
|---|---|
| `docs/spec/GAITR.docx` | The v1.0 strategic platform spec (source) |
| `docs/spec/extracted.md` | Plain-text extraction of the spec — grep-able, line-citable |
| `docs/critique/CRITIQUE.md` | 8-cluster design critique with prioritized backlog |
| `docs/decisions/NNNN-*.md` | Architecture Decision Records (ADRs) — one per non-trivial choice (0001–0004 written) |
| `docs/agents/*.md` | Per-agent capability specs — `README.md` (template + index); first spec `discovery-scout.md` (ADR 0004) |
| `app/`, `components/`, `lib/`, `drizzle/` | **Alchemy Engine v0.1** — Next.js 16 app at repo root (flattened from `apps/alchemy/` so Vercel deploys with zero config) |
| `README.md` | Run instructions for the Alchemy Engine |
| `DEPLOY.md` | Vercel + Neon deploy recipe + one-click button URL |
| `lib/alchemy/` | Matcher + synthesizer + provider abstraction + versioned prompts |
| `lib/pipeline/` | Phase 2 — six typed stage functions + the `runStage` wrapper (atomic `ON CONFLICT` claim, `running → succeeded\|failed` lifecycle, `agent_runs.decisionRecordId` linkage) |
| `lib/orchestrator/` | Phase 3 (ADR 0005) — Tier-1 controller: `types`, `state`, `planner` (pure rules), `dispatcher`, `gate` (governance tier table), `eval` (3 metrics), `audit`, `tick` |
| `lib/ops/` | Auth helpers (`OPS_ADMIN_TOKEN` bearer) + replay shared core |
| `lib/command-center/` | Command Center read model (`overview.ts` — now reads orchestrator activity too) + the pipeline-stage spec |
| `lib/db/` | Drizzle schema (18 tables) + seed for tools, synergies, SAIF corpus, source registry, incidents, demo scenarios, pipeline runs. Migration 0002 adds `agent_runs.input jsonb` for ops replay. |
| `app/api/cron/orchestrator/tick/` | Vercel cron entry (`*/15 * * * *`, `CRON_SECRET` header). |
| `app/api/ops/` | 7 operator routes — tick / stages/:id/trigger / runs / runs/:id / runs/:id/{replay,retry} / eval / login |
| `app/ops/` | Agent Operations page + token-only login form |
| `proxy.ts` | Edge proxy gating `/ops/*` + `/api/ops/*` (unset `OPS_ADMIN_TOKEN` → 404) |
| `vercel.json` | Framework config + the 15-minute cron entry |
| `docs/services/governance.md` | Governance gate service spec (Phase 3) |
| `scripts/vercel-build.mjs` | Vercel-only build hook: runs migrate + idempotent seed if `DATABASE_URL` is present, then `next build` |
| `.claude/settings.json` | Hooks: SessionStart prints branch + last commit + open todos |
| `CLAUDE.md` | This file |

## Current state

- **Branch**: `claude/review-gaitr-file-KK0iC`
- **Last meaningful artifact**: Phase 3 — Tier-1 orchestrator + the
  Agent Operations page (ADR 0005). Seven commits: ADR 0005 locks
  Vercel Cron for v1 scheduling + atomic `INSERT ... ON CONFLICT`
  fix for the runStage race + embeddings deferred; `runStage`
  rewritten with the atomic claim, `running → succeeded|failed`
  lifecycle, and `agent_runs.decisionRecordId` linkage closing the
  B1 audit gap; `lib/orchestrator/` ships an 8-module slice (types,
  state, planner, dispatcher, gate, eval, audit, tick) plus a
  pure-planner test suite; `lib/orchestrator/gate.ts` is the
  governance gate (hard-coded tier table per ADR 0005 D7) writing
  `review_queue` rows for fingerprints / mappings / briefs / scenarios;
  `lib/orchestrator/eval.ts` writes 3 deterministic metrics per tick
  over a 24h window; `/api/cron/orchestrator/tick` registered on a
  `*/15 * * * *` Vercel cron (auth via `CRON_SECRET`); `proxy.ts`
  gates `/ops/*` + `/api/ops/*` with an `OPS_ADMIN_TOKEN` env-var
  bearer-token model (unset → 404); the operator API ships 7 routes
  (tick, stage trigger, replay, retry, runs list/get, eval, login)
  backed by a new `agent_runs.input` jsonb column (migration 0002)
  for replay; the `/ops` page renders the scorecard + runs explorer
  (with split-out `ProvenanceFields`) + run controls; sidebar gains
  an Operations group; the Command Center's `OrchestratorStatus`
  card flips from "Standby" placeholder to
  "Operational · last tick Xm ago".
- **Design state**: ADRs 0001–0005 written. 0001 (scope & stack) and
  0002 (Alchemy Engine slice) document shipped work; 0003
  (full-platform 3-tier architecture), 0004 (agent design), and
  **0005 (Tier-1 orchestrator + ops, Accepted 2026-05-23)** specify it.
- **Code shipped**: Alchemy Engine v0.1 + Phase 0 design system + Phase 1
  Command Center + Phase 1 polish (no-DB resilience, 18-scenario demo
  seed) + Phase 2 backend (13 tables, 24 SAIF controls, 12 sources,
  12 incidents, the five typed pipeline stages) + **Phase 3** (atomic
  runStage with decision-record linkage; orchestrator planner +
  dispatcher + governance gate + eval writer; Vercel cron @ 15-min;
  `OPS_ADMIN_TOKEN`-gated operator API with 7 routes; `/ops` page
  with eval scorecard + runs explorer + manual tick/trigger controls;
  Command Center orchestrator card live). Stubbed LLM by default; real
  Sonnet via `ALCHEMY_LLM_PROVIDER=anthropic`. End-to-end working
  locally — build + 63 tests green; all routes 200; a fresh seed lands
  90 agent_runs with 76 linked decision records (24 are pure-code
  ingest+correlate, no LLM), 12 ingestion_events, 12 fingerprints,
  104 incident_tool_links (25 seeded + 79 capability-matched), 49 SAIF
  mappings, 18 briefs; orchestrator tick writes 3 eval rows + its own
  decision_record per cycle.
- **Critique fixes shipped**: B1 (decision-record audit trail + UI
  provenance drawer + agent_runs link), A1 (structured-output-only
  synthesizer + Phase 2 ingestion_events carry `sanitization_flags`),
  C2 (`report` composes briefs over already-mapped data — no new
  analysis), C3 (`extract` replaces Curator + Fingerprint Archivist),
  C4 (governance tier renames in `gate.ts`), C5 (provider abstraction),
  D3 (MITRE ATLAS + ATT&CK ids on `attack_fingerprints`), E2
  (idempotency-keyed agent_runs, now atomic), F1 (deterministic
  candidate generation), F3 (`match_type` distinguishes capability from
  attribution), G2 (eval scorecard — 3 v1 metrics, 2 deferred with
  reasons).
- **Recommended next**: **Phase 4 — surfaces over Phase-3 producers**.
  The Review Queue UI is the natural first slice — Phase 3's
  governance gate now writes `approval-required` rows for
  community-source fingerprints and low-confidence mappings, and Phase
  4 ships the surface that consumes them (CRITIQUE G1: reviewer
  corrections write `feedback_events` → close the loop into
  `feedbackEvents → eval_results.reviewer_override_rate`). Then SAIF
  Alignment, Threat Posture, Threat Knowledge Base (ADR 0003 D5
  surfaces). After Phase 4: Phase 5 (hardening: real auth via
  `users` + Auth.js / ADR 0006, live ingestion behind `/security-review`,
  embeddings for attribution-grade correlate as its own ADR).

## User preferences (durable)

- **Honesty over deference**. Critique should be sharp, fixes concrete. Don't
  hedge to be polite.
- **Free reign on stack and scope** unless explicitly constrained. When unsure,
  propose a default and ask once via `AskUserQuestion`.
- **Think across all angles** (data, AI, UI, UX, governance, security). Don't
  scope down prematurely.
- **Overlap with the Replit build is acceptable** — don't avoid features just
  because gaitr.ai already has them.
- **Commit + push to the designated branch** (`claude/review-gaitr-file-KK0iC`)
  when work completes. Do **not** open PRs unless explicitly asked.

## Working agreements

- Every non-trivial architectural decision → an ADR in `docs/decisions/`.
- Every prompt change to an AI agent → bumps a `promptVersion` and lands in
  `docs/agents/<agent>.md` (folder exists; `docs/agents/README.md` has the
  spec template).
- Every commit message explains WHY, not just WHAT.
- Sub-agents (Explore, Plan) get self-contained briefs that point back at this
  file and the relevant docs. Never assume they inherit conversation context.
- Before each merge: run `/security-review`. Especially before any change to
  the ingestion pipeline (see CRITIQUE.md cluster A).

## Synthesis loop on session resume

1. This file (auto-loaded).
2. `git log --oneline -20` for recent activity.
3. `ls docs/decisions/` for ADRs newer than I last saw.
4. The specific doc for the task at hand.

## Failure modes to watch

- **Stale CLAUDE.md** is worse than no CLAUDE.md. Update it after meaningful
  changes.
- **Decisions made only in conversation** are lost. Land them in an ADR.
- **Sub-agents drift** if not pointed at the right files. Brief them well.

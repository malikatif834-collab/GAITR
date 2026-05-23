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
| `app/`, `components/`, `lib/`, `drizzle/` | **Alchemy Engine v0.1** — Next.js 16 app at repo root (flattened from `apps/alchemy/` in commit `<flatten-sha>` so Vercel deploys with zero config) |
| `README.md` | Run instructions for the Alchemy Engine |
| `DEPLOY.md` | Vercel + Neon deploy recipe + one-click button URL |
| `lib/alchemy/` | Matcher + synthesizer + provider abstraction + versioned prompts |
| `lib/pipeline/` | Phase 2 — the five non-synthesize stages as typed functions (`ingest`, `extract`, `correlate`, `map`, `report`) + the `runStage` wrapper that writes `agent_runs` with idempotency keys + the synthesize wrapper |
| `lib/command-center/` | Command Center read model (`overview.ts`) + the pipeline-stage spec |
| `lib/db/` | Drizzle schema (18 tables: the 5 ADR 0002 tables + the 13 Phase 2 pipeline tables) + seed for tools, synergies, SAIF corpus, source registry, incidents, and demo scenarios + pipeline runs |
| `scripts/vercel-build.mjs` | Vercel-only build hook: runs migrate + idempotent seed if `DATABASE_URL` is present, then `next build` |
| `.claude/settings.json` | Hooks: SessionStart prints branch + last commit + open todos |
| `CLAUDE.md` | This file |

## Current state

- **Branch**: `claude/review-gaitr-file-KK0iC`
- **Last meaningful artifact**: Phase 2 — the data model + pipeline
  backend (ADR 0003 D1). Six commits: the 13-table schema migration
  (`incidents`, `incident_tool_links`, `attack_fingerprints`,
  `saif_controls`, `saif_mappings`, `source_registry`, `ingestion_events`,
  `agent_runs`, `review_queue`, `feedback_events`, `eval_results`,
  `users`, `briefs`); a 24-entry SAIF reference corpus + 12-entry source
  registry seed; 12 hand-curated real-world incidents pre-linked to AI
  tools at attribution vs capability `match_type`; the five non-`synthesize`
  stages as typed functions in `lib/pipeline/` (each call writes one
  `agent_runs` row, idempotency-keyed on the canonical hash of its input;
  pure tag-driven extract, capability-overlap correlate, deterministic-
  pick map, templated report); the Command Center wired through to real
  pipeline data — river nodes show live per-stage run counts and output
  nouns, the radar reads from `saif_mappings`, a new `PipelineOutputStrip`
  surfaces incident / fingerprint / mapping / brief totals, and the
  Orchestrator panel reflects per-stage activity; CLAUDE.md refreshed.
- **Design state**: ADRs 0001–0004 written. 0001 (scope & stack) and 0002
  (Alchemy Engine slice) document shipped work; **0003 (full-platform 3-tier
  architecture) and 0004 (agent design) are `Accepted`** — signed off by the
  user on 2026-05-22.
- **Code shipped**: Alchemy Engine v0.1 + Phase 0 design system + Phase 1
  Command Center + Phase 1 polish (no-DB resilience, 18-scenario demo
  seed) + Phase 2 backend (13 new tables, 24 SAIF controls, 12 sources,
  12 incidents, the five typed pipeline stages in `lib/pipeline/`, Command
  Center wired against `agent_runs` / `saif_mappings`). Stubbed LLM by
  default; real Sonnet via `ALCHEMY_LLM_PROVIDER=anthropic`. End-to-end
  working locally — build + 21 tests green; all routes 200; a fresh seed
  lands 90 agent_runs across all six stages, 12 ingestion_events, 12
  attack fingerprints, 104 incident_tool_links (25 seeded + 79
  capability-matched by `correlate`), 49 SAIF mappings, 18 briefs.
- **Critique fixes shipped**: B1 (decision-record audit trail + UI
  provenance drawer), A1 (structured-output-only synthesizer + Phase 2
  ingestion_events carry `sanitization_flags`), C5 (provider abstraction),
  F1 (deterministic candidate generation), C2 (`report` stage composes
  briefs over already-mapped data — no new analysis), C3 (`extract` is one
  service that replaces Curator + Fingerprint Archivist), D3 (MITRE ATLAS
  + ATT&CK ids on `attack_fingerprints`), E2 (every stage call writes an
  `agent_runs` row keyed by `(stage_id, idempotency_key)`), F3 (`match_type`
  on `incident_tool_links` distinguishes capability from attribution; only
  attribution feeds risk).
- **Recommended next**: **Phase 3 — Tier-1 orchestrator + Agent
  Operations** (gets its own ADR — 0005, to be written). The autonomous
  controller: scheduler + new-data event triggers, stage dispatch over the
  `lib/pipeline/` functions, decision-record audit, governance-gate
  routing (`review_queue` consumer), eval-metric watch. Plus the thin
  Agent Operations page per ADR 0004 D5 — eval scorecard + decision-record
  explainability + operator run-controls. Open design questions for
  ADR 0005: scheduling (Vercel Cron vs BullMQ/Upstash Redis — ADR 0003 D3
  flagged), the `runStage` race (slice 4's `lib/pipeline/run.ts` notes the
  non-atomic check + insert), and embeddings infra for the attribution-
  grade `correlate` path. After Phase 3: Phase 4 (SAIF Alignment, Threat
  Posture, Threat Knowledge Base, Review Queue UI), then Phase 5
  (hardening + live ingestion behind `/security-review`).

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

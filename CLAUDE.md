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
| `lib/db/` | Drizzle schema (5 tables incl. `decision_records` per CRITIQUE.md B1) + seed |
| `scripts/vercel-build.mjs` | Vercel-only build hook: runs migrate + idempotent seed if `DATABASE_URL` is present, then `next build` |
| `.claude/settings.json` | Hooks: SessionStart prints branch + last commit + open todos |
| `CLAUDE.md` | This file |

## Current state

- **Branch**: `claude/review-gaitr-file-KK0iC`
- **Last meaningful artifact**: ADR 0004 — agent design + the ingestion model
  (a taxonomy of three genuine agents, versioned capability specs, a governed
  Source Registry + Discovery Scout, a thin Agent Operations page). Its three
  open questions — Scout cadence, registry edit rights, LLM-trace tool — were
  resolved with the user on 2026-05-22 and folded into D4 / D5.
- **Design state**: ADRs 0001–0004 written. 0001 (scope & stack) and 0002
  (Alchemy Engine slice) document shipped work; **0003 (full-platform 3-tier
  architecture) and 0004 (agent design) are `Proposed`, awaiting the user's
  sign-off**. On sign-off both flip to Accepted and Phase 0 begins.
- **Code shipped**: Alchemy Engine v0.1 — six-commit clean-room build of the
  synergy-synthesis slice. Stubbed LLM by default; real Sonnet via
  `ALCHEMY_LLM_PROVIDER=anthropic`. End-to-end working locally.
- **Critique fixes shipped (in the Engine)**: B1 (decision-record audit trail,
  UI provenance drawer), A1 (structured-output-only synthesizer, no attacker
  text in prompts), C5 (provider abstraction), F1 (deterministic candidate
  generation — specified + implemented + tested).
- **Recommended next**: the user's sign-off on ADRs 0003 + 0004. On sign-off,
  Phase 0 (design-system foundation) begins; the ingestion code (Source
  Registry, connectors, Discovery Scout) lands in Phase 2, behind
  `/security-review` per CRITIQUE cluster A.

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

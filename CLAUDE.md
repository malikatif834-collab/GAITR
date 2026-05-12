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
| `docs/decisions/NNNN-*.md` | Architecture Decision Records (ADRs) — one per non-trivial choice |
| `.claude/settings.json` | Hooks: SessionStart prints branch + last commit + open todos |
| `CLAUDE.md` | This file |

## Current state

- **Branch**: `claude/review-gaitr-file-KK0iC`
- **Last meaningful artifact**: `docs/critique/CRITIQUE.md` — committed, pushed
- **Recommended next slice**: Alchemy Engine, clean-room, standalone (capability
  graph + synergy matcher + scenario LLM + review UI). See `docs/decisions/0001-scope-and-stack.md`.
- **Not yet built**: any code. Repo is docs-only.

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
  `docs/agents/<agent>.md` once that folder exists.
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

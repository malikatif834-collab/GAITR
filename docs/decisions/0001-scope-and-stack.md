# ADR 0001 — Scope, stack, and working mode

- **Status**: Accepted
- **Date**: 2026-05-12
- **Branch**: `claude/review-gaitr-file-KK0iC`

## Context

The user (owner of gaitr.ai, a Replit-built production version of GAITR)
handed over the v1.0 strategic platform spec (`docs/spec/GAITR.docx`) and asked
what could be done with it under "full freedom." The Replit build is
reportedly more advanced than the spec; this repo is treated as a clean-room
workspace where re-doing existing features is acceptable.

The first deliverable agreed was a critical design review, not an
implementation. Subsequent work will likely shift to building.

## Decision

### Working mode
- **Phase 1 (done)**: Design critique of the spec, delivered as
  `docs/critique/CRITIQUE.md`. Eight clusters, severity-tagged, concrete fixes
  per finding, top-10 prioritized backlog, honest "what the spec gets right."
- **Phase 2 (recommended next)**: Build the **Alchemy Engine** as a clean-room
  standalone slice — the most differentiated piece in the spec, bounded scope,
  shippable in a focused sprint. Not yet started; awaits user go-ahead.
- **Out of scope unless asked**: Re-implementing the full 10-agent pipeline,
  GTM/competitive analysis, redesign of the Replit production UI.

### Stack (recommended for the Alchemy Engine slice)
- **Backend**: Node.js + TypeScript, Express or Hono, Zod for validation.
- **Database**: Postgres + Drizzle ORM + drizzle-zod, **pgvector** for novelty
  scoring and similarity (no separate vector DB).
- **Async**: BullMQ on Redis for agent orchestration; idempotency keys on every
  agent action (closes critique findings B1, E2).
- **AI**: Anthropic SDK as primary, with a thin provider-abstraction interface
  (closes critique C5). Routing: Haiku 4.5 for ingestion, Sonnet 4.6 for
  correlation, Opus 4.7 for scenario synthesis. Prompt caching on stable
  system prompts.
- **Frontend**: React 18 + TypeScript + Vite, Tailwind + shadcn/ui, TanStack
  Query, Recharts for standard charts, Cytoscape.js for the threat graph,
  cmdk for the command palette.
- **Auth/RBAC**: Defined up front — Analyst / Reviewer / Admin / Auditor —
  even before multi-tenancy ships (closes critique H1).
- **Observability**: OpenTelemetry → Honeycomb (or Grafana Cloud), Sentry for
  errors.

### Branch and PR policy
- Develop on `claude/review-gaitr-file-KK0iC`.
- Commit + push when work is complete.
- **Do not open PRs** unless the user explicitly requests one.

### Memory / context strategy
- `CLAUDE.md` at repo root is the auto-loaded session briefing.
- Every non-trivial architectural choice gets an ADR here in
  `docs/decisions/`.
- Sub-agent prompts are self-contained and point back at `CLAUDE.md` plus the
  specific files relevant to their task.

## Alternatives considered

- **Fresh full re-implementation** — rejected as months of work for parity
  with a production version that's already ahead.
- **Audit Replit code only** — viable but the user hasn't shared the code; the
  Alchemy Engine slice is more useful with what's available.
- **Match Replit stack exactly** — partially adopted (Postgres + Drizzle,
  React + shadcn) but with deliberate divergence on AI provider (Anthropic
  primary, not Gemini) and on adding pgvector + BullMQ.

## Consequences

- The critique is the source of truth for known design risks. New work should
  cross-reference findings it touches.
- The provider-abstraction commitment means the agent runner has to be
  designed model-agnostic from day one — small upfront cost, large optionality.
- The "no PRs unless asked" rule means cross-session work is journaled via
  commit messages and ADRs, not PR descriptions.

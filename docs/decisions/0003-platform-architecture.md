# ADR 0003 — Full-platform architecture and parity build plan

- **Status**: Proposed — awaiting user sign-off before any app code
- **Date**: 2026-05-22
- **Branch**: `claude/review-gaitr-file-KK0iC`
- **Supersedes / extends**: ADR 0001 (working mode), ADR 0002 (Alchemy slice).
  ADR 0002's Alchemy Engine becomes the `synthesize` stage of the pipeline
  defined here; nothing in 0002 is discarded.
- **Amended by**: ADR 0004 (agent design + ingestion model) — rescopes the
  Agent Operations interface (D5) to a thin page, adds the `source_registry`
  table, and shifts the per-phase ADR numbers (Phase 3 → ADR 0005, Phase 5 →
  ADR 0006).

## Context

ADR 0002 shipped the Alchemy Engine v0.1 — one vertical slice. The user now
wants **full GAITR parity**: the five remaining core interfaces (§8) plus the
agent backend, built in a deliberate design language and on an architecture
fit for 2026 rather than the spec's January-2026 design.

Three things drove this ADR:

1. **Design references.** The user supplied five screenshots: the zarori.ai
   homepage (brand palette), two "watch widget" sets (card system, oversized
   numerics, neon accents, tactile controls), a SaaS analytics dashboard (app
   shell, hex heatmap), and Palo Alto's XSIAM Command Center (the data-flow
   river that is the model for GAITR's Command Center).
2. **The "10 agents" framing is dated.** §6 defines ten "agents" in four
   layers. Most are not agents — they are deterministic jobs or single
   structured-extraction calls. CRITIQUE.md cluster C already documents the
   overlaps (C2 Analyst≈Reporter, C3 Curator≈Archivist) and the contradiction
   (C1 Quality Controller). Ten "agents" means ten prompt surfaces, ten eval
   sets, ten places to drift.
3. **Three decisions locked with the user** (2026-05-22, via AskUserQuestion):
   - Architecture → **3-tier orchestrator model** (this ADR).
   - Autonomy → **autonomous operation, gated publication**.
   - Kickoff → **plan + ADR first**, sign-off before code.

## Decision

### D1 — Architecture: one orchestrator, a 6-stage pipeline, two services

Replace the flat list of ten agents with three tiers.

**Tier 1 — Orchestrator (the one genuinely agentic component).**
A single autonomous controller. Woken by schedule and by new-data events; it
plans what to ingest / re-correlate / re-synthesize / escalate, dispatches
pipeline stages, watches eval metrics, writes decision records, and routes
publishable output to the governance gate. This is the "fully autonomous
threat-intelligence agent" — autonomous at the level of *running the loop*.

**Tier 2 — Pipeline: six stages, deterministic wherever possible.**

| Stage | Replaces | LLM? |
|---|---|---|
| `ingest` | Monitor Agent + Threat Intel Collector | No — fetch + parse |
| `extract` | Curator + Fingerprint Archivist (one service, profiles per CRITIQUE C3) | Yes — single constrained call |
| `correlate` | Incident Correlator (capability- vs attribution-match per CRITIQUE F3) | Embeddings; LLM only for ambiguous tiebreaks |
| `synthesize` | Scenario Synthesizer — **already built (ADR 0002)** | Yes — the one multi-step agentic call |
| `map` | Analyst Agent (SAIF mapping + novelty scoring, RAG) | Yes — single constrained call |
| `report` | Reporter Agent (narrative over already-mapped data per CRITIQUE C2) | Yes — single composition call |

Five LLM call-sites, down from ten. Only `synthesize` is multi-step; the rest
are single schema-constrained calls. Each stage has a typed input/output
contract and is independently testable.

**Tier 3 — Cross-cutting services (not "agents").**

- **Governance Gate** — replaces Policy Enforcer. Pure code: rule evaluation
  + tier routing. Decides auto-publish vs review-queue. Resolves CRITIQUE C1.
- **Eval / Scorecard** — replaces Quality Controller. Pure code: SQL metrics +
  the per-agent scorecard from CRITIQUE G2. Surfaces regressions; does not
  itself trigger writes (resolves the C1 read-only contradiction honestly).

Governance tiers are renamed action-truthful per CRITIQUE C4:
`auto-publish` · `auto-publish-with-audit` · `approval-required` · `metrics-only`.

### D2 — Autonomy posture: operate automatically, publish through a gate

The orchestrator runs the entire loop unattended. **New or materially-changed
intelligence (tools, incident links, scenarios, SAIF mappings) crosses a human
governance gate before entering the published catalog.** Rationale: a pipeline
that auto-publishes synthesized threats is CRITIQUE A1's worst case made live —
the register gets poisoned by the threats it catalogs. Gated publication is
also the SAIF-aligned answer; SAIF explicitly requires human oversight of
high-impact decisions. Autonomy lives in *operation*, not *publication*.

### D3 — Design language: Zarori palette, screenshot-derived system

Brand tokens, read from the zarori.ai screenshot (hex is the source of truth;
to be refined if the user supplies the site's CSS `:root`):

| Token | Hex | Role |
|---|---|---|
| `bg` | `#000000` | page background, true black |
| `surface` | `#0E0E11` | card fill |
| `surface-2` | `#16161A` | elevated / hover |
| `border` | `#222226` | hairline borders |
| `primary` | `#CDEB47` | **brand accent** — lime |
| `primary-fg` | `#0A0A0A` | text on lime |
| `text` | `#FFFFFF` | headings |
| `text-muted` | `#8A8A8F` | body |
| `link` | `#4F8BF5` | inline links |

**Rule: lime is the brand/interactive accent only** — active nav, focus rings,
primary CTA, hero highlight. It is never a data-encoding or status color,
because green reads as "safe/resolved" in a threat tool. Two separate scales
carry meaning:

- **Severity** — the existing Okabe-Ito color-blind-safe ramp (ADR 0002),
  red→amber end for critical→low.
- **Neon data palette** — cyan / blue / violet / magenta / amber for chart
  series (sourced from the watch-widget screenshots).

System derived from the references: bento card grid (~24px radius), oversized
tabular numerics as each card's hero element, one saturated fill + soft glow
per card, glassy tactile controls, inline sparklines / radar / contribution
grids. App shell from the analytics-dashboard screenshot: grouped left
sidebar, center canvas, right stat rail, ⌘K command palette.

### D4 — Visualization stack

No data-viz skill is available to the build; bespoke interactive viz is core
capability and needs no external reference.

- **React Flow** — the Command Center pipeline river (custom animated nodes /
  edges). The hero interactive surface.
- **D3 + Canvas** — particle streams along edges, hex heatmap, sankey, radar.
- **visx** — bespoke composable charts.
- **Recharts** — standard sparklines / trend charts (retained from ADR 0001).
- **Framer Motion** — tactile micro-interactions and layout transitions.

Tradeoff accepted: bespoke viz is the long pole of the build, but it is what
delivers the "interactive control panel" feel the user requires.

### D5 — Interfaces (internal D-codes dropped per CRITIQUE H3)

| Interface | Was | Built? |
|---|---|---|
| Command Center | D10 | New — Phase 1 |
| Alchemy Engine | — | Done (ADR 0002), retheme Phase 0 |
| SAIF Alignment | — | New — Phase 4 |
| Threat Posture | — | New — Phase 4 |
| Threat Knowledge Base | D9 | New — Phase 4 |
| Agent Operations | — | New — Phase 3 |

**Amended by ADR 0004 (D5):** the Agent Operations interface is rescoped from a
bespoke control panel to a *thin page* — eval scorecard, decision-record
explainability, operator run-controls. Infra metrics (latency, cost, traces)
move to the ADR 0001 observability stack, not a bespoke dashboard.

## Data model additions

The five tables from ADR 0002 stay. New tables, introduced by the phase that
needs them (full column specs land in each phase's own ADR where non-trivial):

- `incidents` — real-world AI security incidents (`ingest` output).
- `incident_tool_links` — `correlate` output; carries `match_type`
  (`capability` | `attribution`) so only attribution feeds risk scores
  (CRITIQUE F3).
- `attack_fingerprints` — `extract` output; `mitre_atlas_id[]`,
  `mitre_attack_id[]` for interoperability (CRITIQUE D3).
- `saif_controls` — SAIF reference corpus (6 categories, 10 risk categories);
  reference data for the SAIF Alignment page and `map`-stage RAG.
- `saif_mappings` — `map` output: threat → control, confidence, decision record.
- `source_registry` — governed list of ingestion sources; added by ADR 0004
  (D4). Replaces the spec's hardcoded source strings.
- `ingestion_events` — raw ingest records with `source_trust` and
  sanitization flags (CRITIQUE A1 / A3); FK to `source_registry` per ADR 0004.
- `agent_runs` — stage/orchestrator execution log with idempotency keys
  (CRITIQUE E2).
- `review_queue` — governance-gate queue for publish-gated items.
- `feedback_events` — human corrections; closes the loop into prompt versions
  (CRITIQUE G1).
- `eval_results` — per-stage scorecard metrics (CRITIQUE G2).
- `users` — RBAC: Analyst / Reviewer / Admin / Auditor (CRITIQUE H1).
- `briefs` — `report` output.

## Build plan — six phases

Each phase is several independently-reviewable commits, pushed to
`claude/review-gaitr-file-KK0iC` as completed. **Hard stop for user review
after Phase 1** (the design-language + hero-viz proof). Phases 3–5 each get
their own ADR before they start.

**Phase 0 — Design-system foundation.**
Re-tokenize `globals.css` to the Zarori palette; build the app shell (sidebar
+ canvas + right rail); card primitives (bento, big-numeric, glow, tactile
controls); install viz deps. Retheme the existing Alchemy Engine pages so
nothing looks orphaned. *Verify:* existing Alchemy flow still works under the
new look.

**Phase 1 — Command Center.**
The pipeline river (React Flow + particle edges), Intelligence Spotlight, SAIF
Threat Landscape, Threat Analytics, Orchestrator/stage Status. Real data where
it exists, clearly-labelled stubs elsewhere. *Verify:* river animates, nodes
drill in, page is responsive. **→ stop for user review.**

**Phase 2 — Data model + pipeline backend.**
New tables (above); the six stages as typed functions/jobs; seed the SAIF
corpus and a starter incident set. No live external ingestion yet (its SSRF
surface — CRITIQUE A2 — is deferred to Phase 5 behind a security review).
LLM stubbed by default, real via `ALCHEMY_LLM_PROVIDER` (ADR 0002 pattern).

**Phase 3 — Orchestrator + Agent Operations.**
Tier 1: scheduler + event triggers, stage dispatch, decision records,
governance-gate routing, eval-metric watch. The thin Agent Operations page
(eval scorecard, decision-record explainability, operator run-controls) per
ADR 0004 D5; infra metrics go to the ADR 0001 observability stack. *Own ADR:
0005.*

**Phase 4 — Remaining interfaces.**
SAIF Alignment, Threat Posture, Threat Knowledge Base, and the Review Queue
UI for the governance gate.

**Phase 5 — Hardening.**
Live ingestion behind `/security-review` (SSRF allowlist A2, injection
sanitization A1, rate limits A3); RBAC enforcement (H1); eval harness +
scorecard (G2/G3); STIX export + extension-definition (D1/D2); feedback-loop
closure (G1). *Own ADR: 0006.*

## Alternatives considered

- **Keep the 10-agent model** — rejected with the user: preserves the C1/C2/C3
  overlaps and ten prompt surfaces for no benefit beyond matching the spec.
- **Fully autonomous incl. auto-publish** — rejected with the user: makes
  CRITIQUE A1 a live vulnerability.
- **Straight to code, no plan doc** — rejected with the user in favour of
  sign-off on this ADR first.
- **Separate plan doc** — folded into this ADR instead, matching ADR 0002,
  which carried its own build sequence.

## Consequences

- ADR 0002's Alchemy Engine is reframed as the `synthesize` stage; no rework,
  just integration.
- Five LLM call-sites instead of ten → fewer eval sets, lower cost, a smaller
  prompt-injection surface.
- Deterministic-where-possible makes the pipeline replayable and auditable —
  the core promise of a *register* (CRITIQUE B1).
- "Autonomous operation, gated publication" means the Review Queue UI (Phase 4)
  is load-bearing, not optional.
- Phases 3 and 5 are large enough to warrant their own ADRs (0005, 0006).
- This ADR stays **Proposed** until the user signs off; on sign-off it flips to
  Accepted and Phase 0 begins.

## Open questions for the user

1. **Zarori hex** — proceed with the eyeballed values in D3, or will you paste
   the site's CSS `:root` for an exact match?
2. **Scope of "parity"** — build all six interfaces (Phases 0–5), or stop after
   the Command Center + pipeline (Phases 0–2) and reassess?
3. **Orchestrator scheduling** (Phase 3) — Vercel Cron (simplest, serverless)
   or BullMQ + Upstash Redis (richer queue semantics)? Can be deferred to
   ADR 0005.

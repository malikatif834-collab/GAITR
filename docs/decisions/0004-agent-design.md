# ADR 0004 — Agent design and the ingestion model

- **Status**: Proposed — awaiting user sign-off before any app code
- **Date**: 2026-05-22
- **Branch**: `claude/review-gaitr-file-KK0iC`
- **Extends**: ADR 0003 (full-platform architecture). This ADR refines the
  "agent" abstraction 0003 left implicit and specifies the ingestion model; it
  amends ADR 0003 as noted under *Consequences*.

## Context

ADR 0003 locked the 3-tier architecture but used "agent" as a settled term
without saying what an agent *is*, how it is built, or how it is improved.
Before any app code, the user asked five concrete questions:

1. What *type* of agent runs at each of the three tiers?
2. Do the ingestion agents run deep research?
3. How does an agent know *where* to collect data — is the source list
   hardcoded?
4. How are agents "trained"? What are their skills, prompts, negative prompts?
5. (Raised separately) Is the spec's "Agent Operations" console still needed,
   given modern observability tooling?

Two facts from the source material frame the answers:

- **The spec hardcodes ingestion sources.** `extracted.md` §6 lists the Monitor
  Agent's sources as "GitHub, GitLab, HuggingFace, model registries" and the
  Threat Intel Collector's as "AIID, arXiv, MITRE, security news feeds" — fixed
  string lists, no discovery mechanism. CRITIQUE F2 already flags that
  hand-maintained lists lag the threat landscape.
- **The spec's "Agent Operations" panel has no observability behind it.**
  `extracted.md` §8 defines a bespoke control panel (agent status, run
  controls, queue depths, processing metrics); the roadmap lists "Agent
  Observability" as a future item. There is no OpenTelemetry, no SLI/SLO, no
  metrics export — exactly the dated design ADR 0003 exists to modernize.

This ADR answers questions 1–5 and specifies the ingestion model in depth. The
conversational **Analyst Console and its analyst-persona doctrine are
deferred** to a later ADR, at the user's direction ("we'll get to the rest
later").

Decisions confirmed with the user (2026-05-22):

- Ingestion → **governed Source Registry + bounded Discovery Scout**.
- Agent Operations → **a thin GAITR-specific page**, not a bespoke dashboard.
- Discovery Scout cadence → an **Admin-toggleable schedule setting** (default
  weekly), not a fixed constant.
- Source-registry edit rights → **Admin only**.
- LLM-trace tool → an **interchangeable OTLP sink**, not a single named pick.

## Decision

### D1 — Agent taxonomy: three genuine agents, everything else is a call or code

ADR 0003 already collapsed ten "agents" into five LLM call-sites. This ADR draws
the harder line: a component is an **agent** only if it plans a multi-step
course of action and chooses its own tool calls. By that test, GAITR has
exactly three agents:

| Agent | Tier | Type | Why it is an agent |
|---|---|---|---|
| **Orchestrator** | 1 | Autonomous controller | Plans the loop — decides what to ingest / re-correlate / re-synthesize / escalate, dispatches stages, reacts to eval metrics. |
| **Synthesizer** | 2 (`synthesize`) | Bounded multi-step | Already built (ADR 0002). Matches patterns, reasons over capability sets, emits structured scenarios. |
| **Discovery Scout** | adjacent to `ingest` | Bounded research agent | Researches the landscape for new sources, assesses them, emits proposals. The one place deep research happens. |

Everything else in Tier 2 is **not** an agent:

- `ingest` — pure code: deterministic connectors fetch + parse. No LLM.
- `extract`, `map`, `report` — a single schema-constrained LLM call each. One
  prompt, one structured output, no tool loop. A *call*, not an agent.
- `correlate` — embeddings math; an LLM call only to break ambiguous ties.

This directly answers question 1 (*type per tier*) and question 2 (*do
ingestion agents run deep research*): **ingestion itself runs no deep research
and no LLM at all.** Deep research is expensive, non-deterministic, and the
single largest prompt-injection surface in the system (CRITIQUE A1). It belongs
in exactly one bounded, human-gated place — the Discovery Scout — never spread
across every stage.

### D2 — "Training" is versioned capability specs, not fine-tuning

The user asked how agents are "trained." GAITR does **not** fine-tune model
weights. An agent's behaviour is defined entirely by a **capability spec**:

```
capability = model + system prompt + tools + retrieval context + few-shot examples
```

Every element is versioned text or config, checked into the repo. No fine-tuning
because:

- Fine-tuned weights cannot be diffed, reviewed, or replayed — they break the
  B1 audit trail (a decision six months old must be re-runnable from its
  recorded `promptVersion` + `modelId`).
- A prompt/few-shot change can be eval-gated per change (CRITIQUE G3); a weight
  update cannot, cheaply.
- Versioned text specs are reviewable in a PR; weights are not.

Mapping the user's vocabulary to GAITR's mechanics:

- **"Skills"** = the agent's tool set. The Discovery Scout's skills are web
  search and a structured `propose_source` emitter — nothing else.
- **"Prompts"** = the versioned system prompt, named `{agentName}@{semver}`,
  reusing the existing convention (`lib/alchemy/prompts/*.ts`,
  e.g. `sceneSynth@1.0.0`) and recorded in `decision_records.prompt_version`.
- **"Negative prompts"** = explicit must-not constraints + refusal rules +
  *structural* guardrails. The strongest negative prompt is structural: the
  Synthesizer already emits only via a tool schema (`tool_choice`), so there is
  no free-form channel for injected instructions to act through. Every agent
  spec carries an explicit refusal-rules section.
- **"How it gets better"** = the closed feedback loop (CRITIQUE G1):
  `feedback_events` corrections accumulate per agent + error type → a job drafts
  new few-shot examples and a prompt diff → the diff goes through human approval
  → an approved diff becomes the next `promptVersion`, eval-gated (G3), tied to
  the audit trail (B1). That is how an agent "learns" without touching weights.

### D3 — Per-agent spec format: `docs/agents/<name>.md`

CLAUDE.md already anticipates `docs/agents/<agent>.md` as the home for every
prompt-version change. This ADR instantiates the folder and fixes the format.
Each agent spec has these sections:

1. **Identity & role** — one paragraph: what it is, what it is responsible for.
2. **Tier & type** — placement in the 3-tier model; agent / call / code.
3. **Capabilities (tools)** — the exact tool set. Tools the agent must *not*
   have are named explicitly.
4. **I/O contract** — typed input and output. For agents that write the DB, the
   tables and the allowed `status` values.
5. **System prompt** — the versioned prompt, or a pointer to its
   `lib/.../prompts/*.ts` module and current `{agentName}@{semver}`.
6. **Constraints & refusal rules** — the negative prompts: must-not actions,
   injection-resistance rules, output-channel restrictions, per-run caps.
7. **Few-shot examples** — canonical examples, including at least one
   adversarial/refusal example. These double as eval-set seeds.
8. **Eval set & acceptance threshold** — the labelled regression set and the
   bar a prompt-version bump must clear (CRITIQUE G3).
9. **Model assignment** — which model, via the provider abstraction (CRITIQUE
   C5); never hardcoded in agent logic.
10. **Change log** — `{agentName}@{semver}` history with the rationale per bump.

Seeded now: `docs/agents/README.md` (the template + an index) and
`docs/agents/discovery-scout.md` (the first full spec — ingestion is this ADR's
focus). The Orchestrator and Synthesizer specs are back-filled when Phase 3
starts and from ADR 0002 respectively.

### D4 — The ingestion model: Source Registry + connectors + Discovery Scout

This is the core of the ADR and the answer to question 3 (*how does it know
where to look — is it hardcoded?*). **No.** Three parts:

**1. The `source_registry` table — sources are governed data, not code.**
The spec's hardcoded source strings become rows in a `source_registry` table. A
source is a typed, reviewable record with a lifecycle `status`. Adding or
retiring a source is a data change under governance, not a code deploy — which
is what CRITIQUE F2 demands. The registry ships seeded with a vetted starter
set: GitHub, HuggingFace, arXiv (cs.CR / cs.AI), the AI Incident Database,
MITRE ATLAS, and a small set of vendor security advisories.

**2. Connectors — deterministic, per-source-type, no LLM.**
Each `source_type` (`github`, `huggingface`, `arxiv`, `rss`, `mitre`, …) has a
deterministic adapter: fetch via the source's API or feed, parse to the
`ingestion_events` shape. This is the `ingest` stage from ADR 0003 ("No — fetch
+ parse"). Connectors enforce the CRITIQUE A2 controls — domain allowlist,
body-size cap, wall-clock timeout, private-IP block after DNS resolution.
*Live* ingestion stays gated to Phase 5 behind `/security-review`, per ADR 0003
— this ADR specifies the model, not its activation.

**3. The Discovery Scout — bounded research, proposals only.**
The registry must grow without a developer editing a list. The Discovery Scout
is the one agent that does deep research. It runs on a configurable schedule —
an **Admin-set cadence** (daily / weekly / monthly), with optional
event-triggered runs when the eval scorecard surfaces a capability-coverage gap.
The cadence is platform configuration, not a code constant; it defaults to
weekly and is changed from the Agent Operations run-controls (D5). Each run, it:

- reads the current registry and the eval scorecard's capability-coverage gaps;
- researches the landscape (web search) for new high-signal sources;
- emits **`SourceProposal`** records — `source_registry` rows with
  `status = proposed`.

Hard boundaries — the Scout **never**:

- runs a connector or ingests anything itself;
- writes the tool catalog, incidents, or any published table;
- emits a source outside the supported `source_type` set;
- acts on instructions embedded in search results (CRITIQUE A1) — it emits only
  through the `propose_source` tool schema;
- exceeds its per-run proposal cap.

An **Admin** approves a `proposed` source at the governance gate before any
connector is ever pointed at it. Registry edits — add / retire / approve /
reject — are an **Admin-only** right (RBAC, CRITIQUE H1); Reviewer does not get
source rights, keeping the trust boundary tight. This is the security spine of
the ingestion model: deep research is sandboxed to *proposing data sources*,
and an Admin stands between a proposal and a live fetch — closing A1 (no
instruction channel), A2 (no Scout-initiated fetch), and A3 (proposed sources
carry trust metadata and require approval).

So the data path is: **Discovery Scout proposes → human approves → connector
ingests → pipeline processes.** Nothing is hardcoded; nothing is free-roaming.

### D5 — Agent Operations: a thin GAITR-specific page (amends ADR 0003)

Question 5: is the "Agent Operations" console still needed? **Mostly not — but
not entirely.** Generic observability genuinely covers the bulk of it:

- Infra telemetry — latency, throughput, error rate, queue depth, token usage,
  cost, distributed traces — goes to the ADR 0001 observability stack:
  OpenTelemetry → Grafana / Honeycomb, Sentry for errors, plus an LLM-trace
  tool for prompt / token / eval tracing. The trace tool is an
  **interchangeable OTLP sink**: GAITR instruments every LLM call as an
  OpenTelemetry span using the GenAI semantic conventions (ADR 0001 already
  mandates OpenTelemetry), so Langfuse, Arize Phoenix, and Braintrust are all
  supported as the backend and selected by config — the same swap-by-config
  pattern as the C5 provider abstraction, not a re-instrumentation. Langfuse is
  the default (open-source, self-hostable). The one part that does not port for
  free is a vendor's proprietary eval-experiment UI — but GAITR keeps its eval
  sets and acceptance thresholds in-repo (D2 / D3) and its eval scorecard on the
  thin page below, so the trace tool stays a pure sink. Rebuilding any of this
  as bespoke React pages would be strictly worse than the real tools.
- Live pipeline status already has a home: ADR 0003 puts Orchestrator/stage
  status on the **Command Center** (Phase 1).

Three things off-the-shelf observability does **not** do, and which GAITR
therefore keeps — on **one thin page**:

1. **Domain eval scorecard** — per-stage quality metrics (CRITIQUE G2: linkage
   precision, confidence calibration, reviewer-override rate, SAIF-mapping
   agreement, scenario approval rate) and regression flags (G3). Honeycomb
   measures span timings; it cannot tell you a SAIF mapping is *wrong*.
2. **Decision-record explainability** — browse `decision_records` and
   `agent_runs`: *why* the orchestrator chose a given action. Infra traces
   capture timing, not reasoning.
3. **Operator run-controls** — manual trigger / pause / replay / retry of a
   stage or run. Admin-gated. Observability dashboards are read-only.

The page links out to Grafana / Honeycomb for infra metrics rather than
reproducing them. Net effect on ADR 0003: the **Agent Operations interface
stays in D5 (six interfaces), but is rescoped** from a bespoke control panel to
this thin page.

## Data model additions

ADR 0003's table set stands. This ADR adds one table and amends one:

- **`source_registry`** *(new)* — the governed source list. Indicative columns:
  `id`, `name`, `source_type` (`github` | `huggingface` | `arxiv` | `rss` |
  `mitre` | …), `endpoint`, `fetch_config` (jsonb — query params, rate limits),
  `status` (`active` | `proposed` | `rejected` | `disabled`), `trust_tier`,
  `proposed_by` (agent vs human actor), `rationale`, `created_at`,
  `reviewed_by`, `reviewed_at`. Discovery Scout proposals are simply rows with
  `status = proposed` — no separate proposals table (mirrors how ADR 0003
  reuses `review_queue`). The full column spec lands with Phase 2.
- **`ingestion_events`** *(amended)* — gains a foreign key to `source_registry`,
  so every raw ingest record is attributable to a governed source.

## Build sequencing

ADR 0004 ships **no application code** — it is a design ADR. Its decisions land
across ADR 0003's existing phases:

- `docs/agents/` (README + Discovery Scout spec) lands **with this ADR** —
  documentation only.
- `source_registry` table, the deterministic connectors, and the Discovery
  Scout implementation land in **Phase 2** (data model + pipeline backend).
  Live external ingestion remains gated to **Phase 5** behind `/security-review`
  (CRITIQUE A2), unchanged from ADR 0003.
- The thin Agent Operations page lands in the **Phase 3 / Phase 4** range, per
  the rescoped ADR 0003.
- The agent prompt modules (`lib/.../prompts/*.ts`) and per-agent eval sets are
  created when each agent is built; each gets its `{agentName}@{semver}` and a
  spec in `docs/agents/`.

## Alternatives considered

- **A deep-research agent does the ingesting directly** — rejected. It is the
  maximum SSRF (A2) and prompt-injection (A1) surface, non-deterministic, and
  un-auditable. The connector/Scout split keeps deep research bounded to
  proposing sources and keeps the fetch path deterministic.
- **Keep sources hardcoded (the spec's model)** — rejected per CRITIQUE F2: the
  landscape outruns hand-maintained lists, and a code deploy per source does
  not scale.
- **Registry only, no Discovery Scout** — rejected. The registry would never
  grow without manual curation; the Scout is the autonomy the user asked for,
  made safe by the human gate.
- **Fine-tuning agents** — rejected per D2: breaks replay/audit (B1), cannot be
  diffed or eval-gated per change (G3).
- **Fully drop the Agent Operations interface** — considered; the user chose
  the thin-page middle path, so the eval scorecard and decision-record
  explainability keep a dedicated home rather than being scattered.

## Consequences

- GAITR has a small, auditable agent surface: **three agents**, four
  schema-constrained calls, one deterministic-code stage. Three prompt surfaces
  to eval and version, not ten.
- `source_registry` makes "where do we collect from" a governed, reviewable
  artifact — the answer to the user's hardcoding question.
- The Discovery Scout delivers autonomous source growth without opening
  A1 / A2 / A3, because it only ever *proposes* and a human gates every
  activation.
- `docs/agents/` becomes the single source of truth for every agent's
  capability spec; CLAUDE.md's prompt-version convention is now concrete.
- **Amends ADR 0003**: (a) the Agent Operations interface is rescoped to a thin
  page; (b) `source_registry` is added to the data model; (c) the per-phase ADR
  numbers shift — Phase 3 → ADR 0005, Phase 5 → ADR 0006 — because 0004 is now
  this agent-design ADR.
- The Analyst Console and analyst-persona doctrine remain open — a later ADR,
  when the user "gets to the rest."
- The three open questions on Scout cadence, registry edit rights, and the
  LLM-trace tool are resolved (2026-05-22) and folded into D4 / D5; only the
  Analyst Console remains deferred.
- This ADR stays **Proposed** until the user signs off; on sign-off it and
  ADR 0003 flip to Accepted and Phase 0 begins.

## Open questions for the user

Questions 1–3 were **resolved with the user on 2026-05-22** and folded into the
decisions above — Scout cadence (D4: Admin-toggleable, default weekly),
source-registry edit rights (D4: Admin only), and the LLM-trace tool
(D5: interchangeable OTLP sink). One question remains open:

1. **Analyst Console + persona doctrine** — deferred by your direction; it will
   get its own ADR. Flagged here so it is not lost.

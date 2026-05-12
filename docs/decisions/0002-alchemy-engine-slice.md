# ADR 0002 — Alchemy Engine, v0.1 slice

- **Status**: Accepted
- **Locked choices** (2026-05-12):
  - LLM: stubbed in v0.1 (deterministic canned scenario), Anthropic SDK wired but not called; user supplies key later
  - Deploy: Vercel + Neon Postgres for live demo URL
  - Seed: hand-picked well-known AI tools
  - Cadence: build all 6 commits straight through, single review at the end
- **Date**: 2026-05-12
- **Branch**: `claude/review-gaitr-file-KK0iC`
- **Supersedes / extends**: ADR 0001 (commits to building the Alchemy Engine slice)

## Context

The Alchemy Engine is the most differentiated piece of GAITR per the spec
(`docs/spec/extracted.md`) and per CRITIQUE.md cluster F (where it also has the
biggest unaddressed risks: combinatorial explosion, manual synergy curation,
attribution vs capability-match confusion). Building a clean-room standalone
slice lets us:

- Validate the synergy + scenario synthesis loop end-to-end in a focused sprint.
- Bake in the critique fixes (structured-output ingestion, decision records,
  candidate-generation algorithm) from day one.
- Produce a deployable demo (Vercel) that you can show without dragging the
  full 10-agent pipeline along.

## Scope of v0.1

**In:**

1. Seed catalog of ~30 well-known AI tools with capability tags (hand-curated;
   no live ingestion in v0.1).
2. Synergy pattern library: the 5 from Appendix C + 5–10 additional patterns,
   stored in DB, editable via SQL.
3. Deterministic synergy matcher: pure function `(toolIds[]) → matchedPatterns[]`
   based on capability set membership.
4. Scenario synthesizer agent: LLM-driven, structured-output-only, takes
   `(tools, matched patterns)` and returns
   `{ narrative, emergentCapabilities[], mitigations[], saifControls[], confidence }`.
5. Decision-record audit trail (closes critique B1): every scenario stores
   `promptVersion, modelId, modelParams, inputHash, outputHash, retrievalSources`.
6. Web UI:
   - **Tool picker** — searchable, multi-select, capability-tag chips
   - **Synergy preview** — which patterns matched and why
   - **Scenario card** — narrative, emergent caps, SAIF mapping with citations,
     confidence, "show provenance" drawer
   - **Scenarios list** — recent + saved scenarios
7. Single API: `POST /api/alchemy/synthesize`, plus read endpoints for tools,
   patterns, scenarios.
8. Single dev user. No auth wired (closes critique H1 in spec only — see
   v0.2 plan).
9. Local Postgres via Docker Compose; Neon for any deployed demo.

**Out (deferred):**

- Novelty scoring via pgvector (v0.2 — table is provisioned, not used yet).
- Auto-discovered synergy patterns (v0.2).
- Human review queue UI (v0.2 — pending proposals table exists, no UI yet).
- Eval harness with labeled set (v0.3).
- Confidence calibration (v0.3 — until then, confidence is LLM-self-reported
  and labeled as such in UI).
- RBAC / multi-tenancy (later).
- Live ingestion (Monitor Agent, Threat Intel Collector — separate slice).
- STIX export (separate slice).

## Stack (confirms ADR 0001 with concrete choices)

- **Framework**: Next.js 15 App Router + TypeScript. One project, one deploy
  target, server actions for mutations, Vercel-native.
- **DB**: Postgres + Drizzle ORM + drizzle-zod, **pgvector** extension
  installed (table provisioned for v0.2 novelty work).
- **AI**: Anthropic SDK. Scenario synthesizer = `claude-sonnet-4-6`.
  Prompt caching on the system prompt + SAIF reference corpus.
- **UI**: Tailwind + shadcn/ui + Lucide icons + TanStack Query (server state).
- **Validation**: Zod end-to-end (drizzle-zod for DB, hand-written for AI
  outputs, shared schemas between server and client).
- **Local dev**: Docker Compose (Postgres + pgvector), `.env.local`,
  `pnpm` package manager.
- **Deploy target**: Vercel (via the Vercel MCP) + Neon Postgres.

## Data model (v0.1)

```
ai_tools
  id              uuid pk
  name            text not null
  vendor          text
  url             text
  description     text
  capabilities    text[] not null              -- capability tag set
  source_trust    text not null default 'seed' -- seed | curated | ingested
  created_at      timestamptz
  -- v0.2: embedding vector(1536) for novelty

capability_synergies
  id                      uuid pk
  name                    text not null              -- e.g. "Vishing"
  required_capabilities   text[] not null            -- AND semantics
  emergent_threat         text not null
  risk_multiplier         numeric(3,2) not null
  saif_controls           text[] not null
  rationale               text not null              -- why this combo is risky
  source                  text not null default 'curated'  -- curated | proposed | ai-discovered
  created_at              timestamptz

alchemy_scenarios
  id                  uuid pk
  tool_ids            uuid[] not null
  matched_pattern_ids uuid[] not null
  narrative           text not null
  emergent_caps       text[] not null
  mitigations         jsonb not null              -- [{control, action, rationale}]
  saif_controls       text[] not null
  confidence          numeric(3,2) not null       -- LLM-self-reported, marked as such in UI
  decision_record_id  uuid not null fk
  created_at          timestamptz

decision_records                                  -- closes critique B1
  id                  uuid pk
  agent_name          text not null               -- 'scenario-synthesizer'
  prompt_version      text not null               -- 'sceneSynth@1.0.0'
  model_id            text not null               -- 'claude-sonnet-4-6'
  model_params        jsonb not null
  input_hash          text not null               -- sha256 of canonical input
  output_hash         text not null
  retrieval_sources   jsonb                       -- [{kind:'saif', id, version}]
  prompt_tokens       int
  completion_tokens   int
  cost_usd            numeric(10,6)
  created_at          timestamptz

pending_synergy_proposals                         -- table exists, UI in v0.2
  id                  uuid pk
  proposed_synergy    jsonb not null
  status              text not null default 'pending'  -- pending|approved|rejected
  reviewer_notes      text
  reviewed_by         text
  reviewed_at         timestamptz
  created_at          timestamptz
```

Indexes: GIN on `ai_tools.capabilities`, GIN on `capability_synergies.required_capabilities`.

## Capability graph + synergy matcher (deterministic, no LLM)

```ts
// packages/alchemy/match.ts
export function matchSynergies(
  tools: Tool[],
  patterns: SynergyPattern[]
): MatchedPattern[] {
  const capSet = new Set(tools.flatMap(t => t.capabilities));
  return patterns
    .filter(p => p.requiredCapabilities.every(c => capSet.has(c)))
    .map(p => ({
      pattern: p,
      contributingTools: tools.filter(t =>
        t.capabilities.some(c => p.requiredCapabilities.includes(c))
      ),
    }));
}
```

Pure function, fully unit-testable, no LLM. Closes critique F1's complaint about
unspecified candidate generation for the deterministic path.

## Scenario synthesizer agent

**Role**: Given (tools, matched patterns), produce a coherent threat scenario
narrative with explicit emergent capabilities, mitigations, and SAIF mappings.

**Prompt design** (`promptVersion: sceneSynth@1.0.0`):

- System prompt (cached): role + SAIF control reference + output schema +
  refusal rules ("if input is empty or contradictory, return
  `{error:'insufficient-input'}`")
- User prompt: structured JSON only — `{ tools: [...], patterns: [...] }`. No
  free-form attacker text in the prompt (closes critique A1 — even though v0.1
  has no live ingestion, the pattern is set from day one).
- Output: enforced via `tools` API with `tool_choice: {type:'tool', name:'emit_scenario'}`
  and a strict input_schema. No free-form text path.

**Model**: `claude-sonnet-4-6` (good narrative + structured-output reliability;
Opus reserved for v0.2 novelty discovery).

**Confidence**: LLM-self-reported in v0.1, labeled in UI as "model-reported,
not calibrated." Calibration is v0.3.

**Audit**: every call writes a `decision_records` row before returning the
scenario. Scenario stores `decision_record_id` FK.

## UI surfaces

Three pages, deliberately small:

1. `/` — **Tool picker + scenario synthesis**
   - Left: searchable multi-select of tools, capability chips, "select all
     voice cloning" quick filter
   - Center: live "X synergy patterns matched" preview as tools are added
   - Right: "Synthesize scenario" CTA → streams the LLM output into a card
2. `/scenarios` — **Recent scenarios**
   - List with severity sort, filter by SAIF control
   - Each row: narrative summary + matched patterns + confidence + provenance link
3. `/scenarios/[id]` — **Scenario detail**
   - Full narrative, emergent capabilities, mitigations table, SAIF mapping
     with control name + link
   - "Show provenance" drawer: prompt version, model, tokens, cost, input
     hash, output hash, retrieval sources — closes critique B1 visibly in UI

Design system: shadcn/ui defaults, dark by default, Okabe-Ito severity palette
for the SAIF/severity badges (color-blind safe).

## Adversarial posture (v0.1 baseline)

Even without live ingestion, the patterns are set from day one:

- **No free-form attacker text reaches the LLM**. All inputs to the synthesizer
  are typed objects from our DB.
- **Tool descriptions are displayed but not piped into prompts** in v0.1. (When
  we wire ingestion in a later slice, descriptions get a sanitization pass
  first.)
- **Output is tool-use-constrained**, no free-form path for the model to deviate.
- **Rate limit** on `/api/alchemy/synthesize` — 30 req/min per IP.
- **No URL fetching** in v0.1 (defers all of CRITIQUE A2).

## Audit / decision records (closes critique B1 in code)

Every scenario writes a `decision_records` row inside the same transaction as
the scenario insert. Schema is exactly the tuple needed to replay the decision
months later: `(promptVersion, modelId, modelParams, inputHash, outputHash,
retrievalSources)`. UI surfaces this via the provenance drawer so the
explainability claim is *demonstrable* on every scenario, not asserted.

## Project structure

```
apps/alchemy/                     ← Next.js app
  app/
    (routes)/
      page.tsx                    ← tool picker + synthesis
      scenarios/page.tsx
      scenarios/[id]/page.tsx
    api/
      alchemy/synthesize/route.ts
      tools/route.ts
      scenarios/route.ts
      patterns/route.ts
    layout.tsx
  components/
    tool-picker.tsx
    scenario-card.tsx
    provenance-drawer.tsx
    saif-badge.tsx
  lib/
    db/
      schema.ts                   ← drizzle schema
      client.ts
      seed.ts                     ← seed tools + patterns
    alchemy/
      match.ts                    ← deterministic matcher
      synthesize.ts               ← anthropic call + decision record
      prompts/
        scene-synth.v1.ts         ← versioned prompt
    types.ts                      ← shared zod schemas
  drizzle/                        ← migrations
  docker-compose.yml              ← local Postgres + pgvector
  .env.example
  package.json
  README.md                       ← run instructions
```

## Build sequence

Six commits, each independently reviewable:

1. **Scaffold**: Next.js + Tailwind + shadcn/ui + Drizzle + Docker compose +
   env example. Repo runs `pnpm dev` against local DB. No features yet.
2. **Schema + seed**: Drizzle schema for all 5 tables, migrations, seed
   script with ~30 tools + ~10 synergy patterns. `pnpm db:seed` populates.
3. **Matcher + tests**: Pure-function synergy matcher with vitest unit tests
   covering happy path, no-match, partial-match, multi-pattern-match.
4. **Synthesizer + decision records**: Anthropic call wired, structured output
   via tool use, decision record written in same transaction. API route works
   end-to-end with curl.
5. **UI**: Tool picker + scenario card + scenarios list + provenance drawer.
   Streams synthesis to the card. Dark theme, severity badges.
6. **Polish + README**: Empty/loading states, error handling, README with
   one-command setup, `.env.example`, screenshots optional.

Each commit is a clean unit. I'll commit + push after each step.

## Verification (how we'll know v0.1 works)

- `pnpm db:seed` populates 30 tools + 10 patterns in a fresh DB.
- `vitest run packages/alchemy` passes (matcher unit tests).
- `curl POST /api/alchemy/synthesize` with `{toolIds:[...]}` returns a
  valid scenario JSON + persists a row + persists a decision_records row.
- UI flow: pick 2 tools (e.g. voice cloning + text generation) → synergy
  preview shows "Vishing" matched → click synthesize → scenario card
  renders with narrative, mitigations, SAIF badges → provenance drawer
  shows model, prompt version, tokens, cost.
- Run `/security-review` against the diff before pushing the final commit.
- Optional: deploy to Vercel via the Vercel MCP for a live demo URL.

## Open questions for the user

1. **Anthropic API key** — do you have one ready, or should I use a local
   stub LLM for the v0.1 build and you swap in the key when running?
2. **Deploy** — Vercel + Neon for a live demo URL, or local-only first?
3. **Seed catalog** — happy with hand-picked well-known AI tools (Eleven
   Labs, HeyGen, Cursor, etc.), or do you want me to seed from a specific
   source?
4. **Scope check** — six commits as listed; OK to proceed end-to-end and you
   review the deployed result, or pause for review after step 3 (matcher) and
   step 5 (UI)?

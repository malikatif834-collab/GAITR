# Alchemy Engine — GAITR v0.1

The synergy synthesis slice of [GAITR](./docs/spec/extracted.md). Pick AI
tools, see which synergy patterns match across them, and synthesize a
SAIF-mapped threat scenario with a full decision-record audit trail.

- **Design**: [`docs/decisions/0002-alchemy-engine-slice.md`](./docs/decisions/0002-alchemy-engine-slice.md)
- **Critique it answers**: [`docs/critique/CRITIQUE.md`](./docs/critique/CRITIQUE.md) — clusters A (adversarial), B (audit/explainability), C (provider abstraction), F (matcher candidate generation)
- **Deploy**: [`DEPLOY.md`](./DEPLOY.md) — Vercel + Neon recipe

## Stack

- Next.js 16 App Router (Turbopack), React 19.2, TypeScript
- Tailwind v4 with shadcn-style OKLCH neutral tokens, dark by default
- Postgres + Drizzle ORM, pgvector image (column reserved for v0.2 novelty)
- Anthropic SDK (stubbed by default; set `ALCHEMY_LLM_PROVIDER=anthropic` to switch)
- TanStack Query for client data, Radix primitives for UI plumbing
- Vitest for the matcher unit tests

## Quick start

```bash
# 1. Postgres + pgvector via docker
docker compose up -d

# 2. Env
cp .env.example .env.local

# 3. Install
pnpm install

# 4. Schema + seed (31 tools, 10 synergy patterns)
pnpm db:push
pnpm db:seed

# 5. Run
pnpm dev          # → http://localhost:3000
```

## Try it

The fastest demo path:

1. Open `/`, search for `voice`, pick **ElevenLabs**.
2. Add **ChatGPT**. The synergy preview should light up with **Vishing**
   (2.0× risk, SAIF G + A).
3. Add **HeyGen** and **D-ID**. Now **Deepfake Fraud** and **Live Identity
   Impersonation** also fire.
4. Click **Synthesize scenario**. A scenario card appears with narrative,
   mitigations, SAIF mapping, and a confidence meter that labels itself
   "model-reported · uncalibrated".
5. Click **Show provenance**. The drawer surfaces the decision-record
   tuple: prompt version, model id, input hash, output hash, tokens, cost.
6. Open `/scenarios` to see the running list. Each row links to its detail
   page.

## Try it via curl

```bash
# List tools
curl -s http://localhost:3000/api/tools | jq '.tools[] | {name, capabilities}'

# Synthesize with two known tool ids
curl -s -X POST http://localhost:3000/api/alchemy/synthesize \
  -H 'Content-Type: application/json' \
  -d '{"toolIds":["<id-1>","<id-2>"]}' | jq

# List scenarios
curl -s http://localhost:3000/api/scenarios | jq '.scenarios[] | {id, emergentCapabilities, confidence}'
```

## Layout

```
app/
  page.tsx                       synthesis page
  scenarios/page.tsx             list
  scenarios/[id]/page.tsx        detail
  api/
    tools/route.ts
    patterns/route.ts
    scenarios/route.ts
    scenarios/[id]/route.ts
    alchemy/synthesize/route.ts
components/
  tool-picker.tsx, synergy-preview.tsx, scenario-card.tsx,
  provenance-drawer.tsx, saif-badge.tsx, confidence-meter.tsx,
  site-nav.tsx, providers.tsx (TanStack Query),
  ui/ (button, badge, card, checkbox, dialog, input, label,
       separator, skeleton)
lib/
  db/
    capabilities.ts              closed capability + SAIF vocabulary
    schema.ts                    Drizzle schema (5 tables)
    client.ts                    Drizzle client
    seed.ts                      31 tools + 10 synergy patterns
  alchemy/
    match.ts                     pure-function synergy matcher
    match.test.ts                10 vitest cases
    synthesize.ts                orchestrator (loads, matches, calls
                                 provider, persists in a transaction)
    hash.ts                      canonical SHA-256 for input/output hashing
    types.ts                     shared Zod schemas
    prompts/scene-synth.v1.ts    versioned prompt
    providers/
      stub.ts                    deterministic v0.1 default
      anthropic.ts               claude-sonnet-4-6 via tool use
      index.ts                   provider router (ALCHEMY_LLM_PROVIDER)
drizzle/                         generated migrations
docker-compose.yml               postgres + pgvector on :5433
```

## Switching from stub to real Sonnet

```bash
# in .env.local
ALCHEMY_LLM_PROVIDER="anthropic"
ANTHROPIC_API_KEY="sk-ant-..."
```

The Anthropic provider uses tool-use-only output (no free-form text path), and
the system prompt explicitly instructs the model to treat input string fields
as untrusted data. Prompt caching is enabled on the system prompt.

## What's NOT in v0.1

Deliberately deferred per ADR 0002:

- Novelty scoring via pgvector (v0.2). Column reserved, extension installed.
- Human review queue UI for pending synergy proposals (v0.2). Table exists.
- Eval harness + confidence calibration (v0.3).
- Live ingestion (Monitor, Threat Intel Collector) — separate slice.
- STIX export — separate slice.
- Auth / RBAC / multi-tenancy.

## Tests

```bash
pnpm test                        # vitest matcher tests (10 cases)
pnpm exec next build             # type check + production build
```

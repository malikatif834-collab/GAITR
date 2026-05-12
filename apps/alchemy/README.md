# Alchemy Engine — GAITR v0.1

The synergy synthesis slice of [GAITR](../../docs/spec/extracted.md). Pick AI
tools → see which synergy patterns match → generate a threat scenario with
SAIF mapping and a full provenance record.

Design: [`docs/decisions/0002-alchemy-engine-slice.md`](../../docs/decisions/0002-alchemy-engine-slice.md).
Critique: [`docs/critique/CRITIQUE.md`](../../docs/critique/CRITIQUE.md).

## Stack

- Next.js 16 App Router (Turbopack), React 19.2, TypeScript
- Tailwind v4 + shadcn-style tokens, dark by default
- Postgres + Drizzle ORM + pgvector (provisioned for v0.2)
- Anthropic SDK (stubbed by default in v0.1; set `ALCHEMY_LLM_PROVIDER=anthropic`
  to use real synthesis)

## Quick start

```bash
# 1. Start Postgres + pgvector
docker compose up -d

# 2. Configure environment
cp .env.example .env.local

# 3. Install deps
pnpm install

# 4. Apply schema and seed (lands in commit 2)
pnpm db:push
pnpm db:seed

# 5. Run
pnpm dev
# → http://localhost:3000
```

## Layout

```
app/                 Next.js routes (page + API)
lib/db/              Drizzle schema, client, seed
lib/alchemy/         Synergy matcher + scenario synthesizer
components/          UI components
drizzle/             Generated migrations
```

## Status

Scaffold (commit 1 of 6). Schema, matcher, synthesizer, UI, polish, and
deploy land in subsequent commits per ADR 0002.

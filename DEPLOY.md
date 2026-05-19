# Deploy — one click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmalikatif834-collab%2FGAITR&project-name=gaitr&repository-name=gaitr&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

That button does the whole thing:

1. Vercel imports the repo into a new project named `gaitr`.
2. The Neon Marketplace integration provisions a free Postgres DB and
   auto-injects `DATABASE_URL` into the project env vars.
3. The first build runs `scripts/vercel-build.mjs`, which:
   - applies Drizzle migrations against the new Neon DB
   - runs an idempotent seed (31 tools + 10 synergy patterns)
   - runs `next build`
4. After ~2 minutes the deploy is live. Visit the URL, pick two tools,
   click **Synthesize scenario**.

That's it. No env var paste, no migrations, no seed scripts. The same
flow works every redeploy — the `--once` flag on the seed makes it a
no-op once tools exist, so you can push with confidence.

---

## Optional: real Sonnet instead of the deterministic stub

After the deploy, in the project's **Settings → Environment Variables**:

| Key | Value | Environments |
|---|---|---|
| `ALCHEMY_LLM_PROVIDER` | `anthropic` | Production, Preview |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Production, Preview |

Redeploy. The synthesizer now calls Claude Sonnet 4.6 with tool-use-only
output (no free-form attacker-text path). Skip these vars to stay on the
deterministic stub — useful for the security review and for zero-cost
demos.

---

## Manual import (if you'd rather not use the button)

1. Vercel dashboard → **Add New → Project** → import the `GAITR` repo.
2. Framework Preset auto-detects as Next.js.
3. **Storage tab → Create Database → Neon (Marketplace) → Connect.**
4. **Deployments → Redeploy** (the first import deploy ran before Neon
   was attached, so kick off one more).

The repo is flat — the Next.js app is at the root — so no Root
Directory setting is required.

---

## Running it locally

```bash
docker compose up -d            # Postgres + pgvector on :5433
cp .env.example .env.local      # defaults match the docker port
pnpm install
pnpm db:push                    # apply schema
pnpm db:seed                    # 31 tools, 10 synergies
pnpm dev                        # http://localhost:3000
```

---

## Reseeding or migrating against a remote Neon DB

```bash
export DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
pnpm db:migrate
pnpm db:seed:remote             # deletes + reinserts (clean state)
# or:
pnpm exec tsx lib/db/seed.ts --once   # idempotent — skips if data exists
```

---

## Troubleshooting

**"Build failed: drizzle-kit migrate: relation does not exist"**
The Neon integration didn't inject `DATABASE_URL` before the first
build ran. Redeploy from the Vercel dashboard — env vars are present
on the second build.

**App loads but tools list is empty**
Seed didn't run, usually because `DATABASE_URL` was missing at build
time. Either redeploy, or run `pnpm exec tsx lib/db/seed.ts --once`
locally against the Neon URL.

**Build succeeds but `gaitr.vercel.app` still 404s**
Production Branch on the Vercel project is something we haven't pushed
to. Vercel project → **Settings → Git → Production Branch** → set to
the branch containing the latest code. (After this fix lands, `main`
should be it.)

**Anthropic provider falls back to stub**
Both `ALCHEMY_LLM_PROVIDER=anthropic` *and* `ANTHROPIC_API_KEY` need to
be set. Provider check is fail-soft.

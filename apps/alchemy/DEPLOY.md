# Deploy: Alchemy Engine → Vercel + Neon

A repeatable recipe for getting the Alchemy Engine v0.1 live on Vercel
with a managed Neon Postgres. Should take ~5 minutes.

The existing `gaitr.vercel.app` project (currently 404) should be
deleted from the dashboard first — it has no working deployment and the
domain reservation will block reuse.

---

## 1. Create the Vercel project

1. **Vercel dashboard → Add New → Project**
2. Pick the `GAITR` GitHub repo
3. **Configure Project**:
   - **Root Directory**: `apps/alchemy` *(critical — repo is a monorepo)*
   - **Framework Preset**: Next.js *(auto-detected)*
   - **Build Command**: leave default (`next build`)
   - **Install Command**: leave default (`pnpm install`)
   - **Production Branch**: `claude/review-gaitr-file-KK0iC` *(for now — switch to `main` after merge)*
4. **Don't click Deploy yet** — add env vars first (next step).

## 2. Provision Neon via the Marketplace

In the project's **Storage** tab:

1. **Create Database → Neon (Marketplace)**
2. Free tier is fine for the v0.1 demo
3. Region: pick something close to your Vercel function region (Vercel
   defaults to `iad1`, so `us-east-2 (Ohio)` on Neon is a good match)
4. **Connect to project** — this auto-injects `DATABASE_URL` (and a few
   `POSTGRES_*` aliases) into the project's env vars

Verify in **Settings → Environment Variables** that `DATABASE_URL` is
present for `Production`, `Preview`, and `Development`.

## 3. (Optional) Wire up the real LLM

The synthesizer falls back to a deterministic stub if no provider is
configured. To exercise Claude Sonnet on Vercel, add:

| Key | Value | Environments |
|---|---|---|
| `ALCHEMY_LLM_PROVIDER` | `anthropic` | Production, Preview |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Production, Preview |

Skip this step to keep the demo on the stub (zero cost, deterministic
output, useful for the security review).

## 4. Trigger the first deploy

**Deployments → Redeploy** (or push any commit to the production
branch). Build should succeed cleanly — the DB client is lazy, so an
empty schema won't fail the build.

After the deploy finishes, the homepage will render but **scenarios
list will be empty** because the schema and seed data haven't been
applied yet. That's step 5.

## 5. Apply migrations + seed against the Neon DB

From your local machine:

```bash
# 1. Grab the Neon connection string from Vercel
#    (Project → Settings → Environment Variables → DATABASE_URL → "Show")
export DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"

cd apps/alchemy

# 2. Apply the Drizzle migrations
pnpm db:migrate

# 3. Seed ~30 tools + ~10 patterns
pnpm db:seed:remote
```

`db:seed:remote` is the no-`.env.local` variant — it picks `DATABASE_URL`
straight off the shell so you don't have to write a temporary dotfile.

The seed is **idempotent on tool slugs** but will append duplicate
patterns if run twice. Run it once.

## 6. Verify the live app

Open the production URL. Smoke test:

- [ ] Home page renders the tool picker
- [ ] Tool list populates (proves DB connection + seed worked)
- [ ] Pick two compatible tools (e.g. *GPT-4o* + *AutoGPT*) → **Generate
      Scenario** → scenario card renders within ~1s (stub) or ~3-8s
      (real Claude)
- [ ] Scenario detail page → **Provenance** drawer shows seed signals,
      candidate scoring, LLM provider, and prompt version
- [ ] `/scenarios` lists the generated scenario

If any of those fail, check **Runtime Logs** in the Vercel dashboard.

## 7. Capture the URL

Add it to `README.md` and to ADR 0002 under the *Outcome* section so
future sessions have a pointer.

---

## Troubleshooting

**Build fails with "DATABASE_URL is not set"**
The lazy proxy should prevent this. If it still happens, check that
you're on commit `fcb6d95` or later.

**Scenarios endpoint 500s with "relation does not exist"**
Migrations haven't been applied. Run step 5.

**Scenarios endpoint 200s but list is empty**
Migrations ran, seed didn't. Run `pnpm db:seed:remote`.

**LLM falls back to stub even with `ANTHROPIC_API_KEY` set**
Check that `ALCHEMY_LLM_PROVIDER=anthropic` is also set. The provider
defaults to the stub unless explicitly switched.

**Neon connection works locally but fails in Vercel**
Neon's connection string needs `?sslmode=require` (Vercel's auto-inject
includes this). If you pasted manually, double-check the query string.

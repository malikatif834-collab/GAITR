#!/usr/bin/env node
/**
 * Vercel build hook.
 *
 * If DATABASE_URL is set (Neon Marketplace integration injects it at
 * project creation), apply Drizzle migrations + run an idempotent seed
 * before building the Next.js app. The seed is a no-op on every deploy
 * after the first.
 *
 * If DATABASE_URL is unset (preview deploys for a fork, or someone
 * trying out the build without a DB), skip the DB steps so the build
 * still completes — the lazy DB client will surface a clear runtime
 * error if anyone hits an API route.
 *
 * Local builds use `pnpm build` directly and bypass this hook entirely.
 */
import { spawnSync } from "node:child_process";

const run = (cmd, args) => {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    console.error(`Command failed with exit ${result.status}`);
    process.exit(result.status ?? 1);
  }
};

const hasDb = Boolean(process.env.DATABASE_URL);
console.log(`vercel-build: DATABASE_URL ${hasDb ? "present" : "missing"}.`);

if (hasDb) {
  run("pnpm", ["exec", "drizzle-kit", "migrate"]);
  run("pnpm", ["exec", "tsx", "lib/db/seed.ts", "--once"]);
} else {
  console.log("Skipping migrate + seed: no DATABASE_URL.");
}

run("pnpm", ["exec", "next", "build"]);

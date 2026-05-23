import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { evalResults } from "@/lib/db/schema";
import { computeMetrics, EVAL_METRICS } from "./eval";

/* End-to-end check that the eval writer lands the 3 v1 metrics over
   whatever's in the local DB. DB-touching; skips when DATABASE_URL is
   unset. Doesn't assert specific values (they depend on seed state) —
   only shape, count, and bounded ranges. */

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

const writtenEvalIds: string[] = [];

d("orchestrator/eval — v1 metrics", () => {
  afterAll(async () => {
    if (writtenEvalIds.length) {
      await db
        .delete(evalResults)
        .where(inArray(evalResults.id, writtenEvalIds))
        .catch(() => undefined);
    }
  });

  it("writes one eval_results row per v1 metric on a tick", async () => {
    const now = new Date();
    const rows = await computeMetrics(now);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.metric).sort()).toEqual([...EVAL_METRICS].sort());

    // All metrics should produce non-negative finite values.
    for (const r of rows) {
      expect(Number.isFinite(r.value)).toBe(true);
      expect(r.value).toBeGreaterThanOrEqual(0);
    }

    // Persist-then-cleanup pattern: pull the rows we just wrote so
    // afterAll can clean them up.
    const persisted = await db
      .select({ id: evalResults.id })
      .from(evalResults)
      .where(inArray(evalResults.metric, [...EVAL_METRICS]));
    for (const r of persisted) writtenEvalIds.push(r.id);
  });

  it("fingerprint_coverage is a ratio in [0, 1]", async () => {
    const now = new Date();
    const rows = await computeMetrics(now);
    const persisted = await db
      .select({ id: evalResults.id })
      .from(evalResults)
      .where(inArray(evalResults.metric, [...EVAL_METRICS]));
    for (const r of persisted) writtenEvalIds.push(r.id);

    const coverage = rows.find(
      (r) => r.metric === "extract.fingerprint_coverage",
    );
    expect(coverage).toBeDefined();
    expect(coverage!.value).toBeGreaterThanOrEqual(0);
    expect(coverage!.value).toBeLessThanOrEqual(1);
  });

  it("controls_per_scenario falls back to all-time mean when window empty", async () => {
    // Use a far-future window so nothing is in the 24h window — the
    // fallback path runs. sample_size should be 0; value still finite.
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const rows = await computeMetrics(future);
    const persisted = await db
      .select({ id: evalResults.id })
      .from(evalResults)
      .where(inArray(evalResults.metric, [...EVAL_METRICS]));
    for (const r of persisted) writtenEvalIds.push(r.id);

    const cps = rows.find((r) => r.metric === "map.controls_per_scenario");
    expect(cps).toBeDefined();
    expect(cps!.sampleSize).toBe(0);
    expect(Number.isFinite(cps!.value)).toBe(true);
  });
});
